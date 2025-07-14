package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"project-documenter/parser/parser"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Missing project path")
	}
	projectPath, err := filepath.Abs(os.Args[1])
	if err != nil {
		log.Fatalf("Failed to get absolute path: %v", err)
	}

	// The new, single, unified parser
	p := &parser.UnifiedParser{}

	data, err := p.Parse(projectPath)
	if err != nil {
		log.Fatalf("Parsing failed: %v", err)
	}

	jsonOut, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal JSON: %v", err)
	}

	fmt.Println(string(jsonOut))
}