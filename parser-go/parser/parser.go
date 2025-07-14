package parser

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"project-documenter/parser/types"
	"regexp"
	"strings"
	"sync"
)

// UnifiedParser is a single, powerful parser that scans for various schema types.
type UnifiedParser struct{}

// Parse scans the project path and delegates to specialized parsers.
func (p *UnifiedParser) Parse(projectPath string) (*types.ParsedProjectData, error) {
	var wg sync.WaitGroup
	resultsChan := make(chan *types.ParsedProjectData, 10)
	errorChan := make(chan error, 10)

	// This map will help prevent running the AST script multiple times for different model files in the same project.
	astParserRun := make(map[string]bool)

	err := filepath.Walk(projectPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			if info.Name() == "node_modules" || info.Name() == ".git" || info.Name() == "dist" || info.Name() == "output" {
				return filepath.SkipDir
			}
			return nil // It's a directory, just continue.
		}

		// --- Strategy 1: Prisma Schema ---
		if info.Name() == "schema.prisma" {
			wg.Add(1)
			go func(filePath string) {
				defer wg.Done()
				if data, err := parsePrismaSchema(filePath); err != nil {
					errorChan <- fmt.Errorf("failed to parse prisma schema %s: %w", filePath, err)
				} else if data != nil {
					resultsChan <- data
				}
			}(path)
		}

		// --- Strategy 2: SQL DDL Files ---
		if strings.HasSuffix(info.Name(), ".sql") {
			wg.Add(1)
			go func(filePath string) {
				defer wg.Done()
				if data, err := parseSQLFile(filePath); err != nil {
					errorChan <- fmt.Errorf("failed to parse SQL file %s: %w", filePath, err)
				} else if data != nil {
					resultsChan <- data
				}
			}(path)
		}

		// --- Strategy 3: Mongoose/TypeORM Schemas (via AST parser script) ---
		// We only run this once per project.
		if (strings.HasSuffix(info.Name(), ".model.ts") || strings.HasSuffix(info.Name(), ".schema.ts") || strings.HasSuffix(info.Name(), ".entity.ts")) && !astParserRun[projectPath] {
			astParserRun[projectPath] = true // Mark as run
			wg.Add(1)
			go func(pPath string) {
				defer wg.Done()
				if data, err := parseWithASTScript(pPath); err != nil {
					errorChan <- fmt.Errorf("failed to parse TS project with AST script: %w", err)
				} else if data != nil {
					resultsChan <- data
				}
			}(projectPath)
		}

		// --- Strategy 4: Go AST Parsing ---
		if strings.HasSuffix(info.Name(), ".go") {
			wg.Add(1)
			go func(filePath string) {
				defer wg.Done()
				if data, err := parseGoSourceFile(filePath); err != nil {
					errorChan <- fmt.Errorf("failed to parse Go source file %s: %w", filePath, err)
				} else if data != nil {
					resultsChan <- data
				}
			}(path)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error walking project directory: %w", err)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
		close(errorChan)
	}()

	finalData := &types.ParsedProjectData{
		Entities:      []types.ClassInfo{},
		Classes:       []types.ClassInfo{},
		Functions:     []types.APIFunctionInfo{},
		Relationships: []types.RelationshipInfo{},
	}

	for data := range resultsChan {
		finalData.Entities = append(finalData.Entities, data.Entities...)
		finalData.Classes = append(finalData.Classes, data.Classes...)
		finalData.Functions = append(finalData.Functions, data.Functions...)
		finalData.Relationships = append(finalData.Relationships, data.Relationships...)
	}

	for err := range errorChan {
		fmt.Fprintf(os.Stderr, "Parser error: %v\n", err)
	}

	return finalData, nil
}

// --- Sub-Parsers ---

func parsePrismaSchema(filePath string) (*types.ParsedProjectData, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read prisma schema file: %w", err)
	}

	schemaContent := string(content)

	// Regex to find all model blocks
	modelRegex := regexp.MustCompile(`(?s)model\s+(\w+)\s*\{([^}]+)\}`)

	// Regex to parse fields within a model
	fieldRegex := regexp.MustCompile(`^\s*(\w+)\s+([\w\[\]]+)\s*(@.*)?$`)

	// Regex to parse relationships from relation attributes
	relationRegex := regexp.MustCompile(`@relation\s*\(\s*fields:\s*\[([^\]]+)\]\,\s*references:\s*\[([^\]]+)\]`)

	entities := []types.ClassInfo{}
	relationships := []types.RelationshipInfo{}

	modelMatches := modelRegex.FindAllStringSubmatch(schemaContent, -1)
	if modelMatches == nil {
		return nil, nil // No models found, not an error
	}

	for _, modelMatch := range modelMatches {
		modelName := modelMatch[1]
		modelBody := modelMatch[2]

		entity := types.ClassInfo{
			Name:       modelName,
			Properties: []types.PropertyInfo{},
		}

		lines := strings.Split(modelBody, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "//") {
				continue
			}

			fieldMatch := fieldRegex.FindStringSubmatch(line)
			if fieldMatch != nil {
				propName := fieldMatch[1]
				propType := fieldMatch[2]
				attributes := fieldMatch[3]

				prop := types.PropertyInfo{
					Name: propName,
					Type: propType,
					// Modifiers can be parsed from attributes if needed
				}
				entity.Properties = append(entity.Properties, prop)

				// Check for relationships
				if strings.Contains(attributes, "@relation") {
					// This is a simplified relationship detection.
					// A more robust implementation would parse the full @relation attribute.

					// Try to find the related model type
					relatedModelType := propType
					if strings.HasSuffix(relatedModelType, "[]") {
						relatedModelType = strings.TrimSuffix(relatedModelType, "[]")
					}

					// Heuristic to determine relationship type
					relType := "OneToOne"
					if strings.HasSuffix(propType, "[]") {
						relType = "OneToMany"
					} else if !strings.Contains(attributes, "@unique") {
						// If the foreign key field is not unique, it's likely a ManyToOne
						relationAttrMatch := relationRegex.FindStringSubmatch(attributes)
						if relationAttrMatch != nil {
							relType = "ManyToOne"
						}
					}

					relationships = append(relationships, types.RelationshipInfo{
						From: modelName,
						To:   relatedModelType,
						Type: relType,
					})
				}
			}
		}
		entities = append(entities, entity)
	}

	return &types.ParsedProjectData{
		Entities:      entities,
		Relationships: relationships,
		// Classes and Functions are empty as they are not parsed from prisma schema
		Classes:   []types.ClassInfo{},
		Functions: []types.APIFunctionInfo{},
	}, nil
}

func parseSQLFile(filePath string) (*types.ParsedProjectData, error) {
	// Placeholder - a real implementation would parse DDL into types.ParsedProjectData
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	if strings.Contains(strings.ToLower(string(content)), "create table") {
		fmt.Fprintf(os.Stderr, "Found 'CREATE TABLE' in: %s\n", filePath)
	}
	return nil, nil
}

func parseWithASTScript(projectPath string) (*types.ParsedProjectData, error) {
	exePath, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("failed to resolve parser executable path: %w", err)
	}
	parserDir := filepath.Dir(exePath)
	projectRoot := filepath.Join(parserDir, "..")
	scriptPath := filepath.Join(projectRoot, "src", "scripts", "interface-parser.ts")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("AST parser script not found at %s", scriptPath)
	}

	cmd := exec.Command("npx", "ts-node", scriptPath)
	cmd.Dir = projectPath
	cmd.Env = append(os.Environ(), "TS_NODE_TRANSPILE_ONLY=true")

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("ts-node script execution failed: %w. Stderr: %s", err, string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("ts-node script execution failed: %w", err)
	}

	var parsed types.ParsedProjectData
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse AST output: %w. Output: %s", err, string(output))
	}

	return &parsed, nil
}

func parseGoSourceFile(filePath string) (*types.ParsedProjectData, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	entities := []types.ClassInfo{}
	functions := []types.APIFunctionInfo{}
	relationships := []types.RelationshipInfo{}

	structNames := make(map[string]bool)

	// Extract structs (entities)
	for _, decl := range node.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.TYPE {
			continue
		}
		for _, spec := range genDecl.Specs {
			typeSpec, ok := spec.(*ast.TypeSpec)
			if !ok {
				continue
			}
			structType, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				continue
			}
			structNames[typeSpec.Name.Name] = true
			entity := types.ClassInfo{
				Name:       typeSpec.Name.Name,
				FilePath:   filePath,
				Docs:       "", // Optionally extract doc comments
				Methods:    []types.MethodInfo{},
				Properties: []types.PropertyInfo{},
			}
			for _, field := range structType.Fields.List {
				fieldType := ""
				if ident, ok := field.Type.(*ast.Ident); ok {
					fieldType = ident.Name
				}
				if arrType, ok := field.Type.(*ast.ArrayType); ok {
					if ident, ok := arrType.Elt.(*ast.Ident); ok {
						fieldType = "[]" + ident.Name
					}
				}
				for _, name := range field.Names {
					entity.Properties = append(entity.Properties, types.PropertyInfo{
						Name:       name.Name,
						Type:       fieldType,
						Decorators: []string{}, // Optionally parse struct tags
					})
				}
			}
			entities = append(entities, entity)
		}
	}

	// Extract REST handlers (functions with http.ResponseWriter, *http.Request)
	for _, decl := range node.Decls {
		funcDecl, ok := decl.(*ast.FuncDecl)
		if !ok || funcDecl.Recv != nil {
			continue // Only top-level functions
		}
		if funcDecl.Type.Params != nil && len(funcDecl.Type.Params.List) == 2 {
			// Check for (w http.ResponseWriter, r *http.Request)
			functions = append(functions, types.APIFunctionInfo{
				Name:       funcDecl.Name.Name,
				Method:     "UNKNOWN", // Could try to infer from comments or router setup
				Route:      "",
				Docs:       "",
				ReturnType: "",
			})
		}
	}

	// Relationship extraction: for each struct, check if any field type matches another struct
	for _, entity := range entities {
		for _, prop := range entity.Properties {
			// OneToMany: slice of another struct
			if strings.HasPrefix(prop.Type, "[]") {
				target := strings.TrimPrefix(prop.Type, "[]")
				if structNames[target] {
					relationships = append(relationships, types.RelationshipInfo{
						From: entity.Name,
						To:   target,
						Type: "OneToMany",
					})
				}
			} else if structNames[prop.Type] {
				// OneToOne: direct field of another struct
				relationships = append(relationships, types.RelationshipInfo{
					From: entity.Name,
					To:   prop.Type,
					Type: "OneToOne",
				})
			}
		}
	}

	return &types.ParsedProjectData{
		Entities:      entities,
		Classes:       entities,
		Functions:     functions,
		Relationships: relationships,
	}, nil
}
