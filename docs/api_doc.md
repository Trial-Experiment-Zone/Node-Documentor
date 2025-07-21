# API Documentation

This document provides a detailed overview of the available API endpoints for the project documenter.

## Base URL

All API endpoints are relative to the base URL: `http://localhost:3000`

---

## Documentation Controller

**Base Path:** `/documentation`

This controller manages the generation, retrieval, and deletion of documentation files.

### 1. Get List of Generated Files

- **Endpoint:** `GET /documentation/files`
- **Summary:** Get list of generated documentation files.
- **Description:** Retrieves a list of all documentation files that have been generated and are available in the output directory.
- **Responses:**
  - `200 OK`: Returns an array of file paths.
  - `404 Not Found`: If the output directory does not exist.
  - `500 Internal Server Error`: If there's a server-side problem.

### 2. Get File Content

- **Endpoint:** `GET /documentation/file`
- **Summary:** Get content of a documentation file.
- **Description:** Fetches and returns the content of a specific documentation file.
- **Query Parameters:**
  - `path` (string, required): The full path to the documentation file you want to read.
- **Example:** `GET /documentation/file?path=/home/user/project/output/documentation.md`
- **Responses:**
  - `200 OK`: Returns the content of the file as a string.
  - `404 Not Found`: If the specified file does not exist.

### 3. Generate Documentation

- **Endpoint:** `POST /documentation/generate`
- **Summary:** Generate a Markdown documentation file for a project folder.
- **Description:** Kicks off the documentation generation process for a project located at a given path.
- **Request Body:**
  ```json
  {
    "projectPath": "/path/to/your/project"
  }
  ```
- **Responses:**
  - `201 Created`: Returns the generated documentation as a Markdown file (`documentation.md`).
  - `500 Internal Server Error`: If the documentation generation fails.

### 4. Import Project from Path

- **Endpoint:** `POST /documentation/upload`
- **Summary:** Import a project from a local server path.
- **Description:** Copies a project directory from a specified path on the server to the `uploads` directory. This is a server-side copy operation.
- **Request Body:**
  ```json
  {
    "projectPath": "/path/to/your/project/on/the/server"
  }
  ```
- **Responses:**
  - `200 OK`: Returns a success message and the path to the imported project.
  - `400 Bad Request`: If `projectPath` is missing.
  - `404 Not Found`: If the source `projectPath` does not exist.
  - `500 Internal Server Error`: If the import process fails.

### 5. Delete Documentation File

- **Endpoint:** `DELETE /documentation/file`
- **Summary:** Delete a documentation file.
- **Description:** Deletes a specific documentation file from the output directory.
- **Query Parameters:**
  - `path` (string, required): The path to the file to be deleted.
- **Example:** `DELETE /documentation/file?path=/home/user/project/output/documentation.md`
- **Responses:**
  - `200 OK`: If the file is deleted successfully.
  - `500 Internal Server Error`: If the file deletion fails.

---

## File Manager Controller

**Base Path:** `/file-manager`

This controller provides utilities for interacting with the file system, such as listing files, reading content, and performing file operations.

### 1. List Files and Folders

- **Endpoint:** `GET /file-manager/list`
- **Summary:** List files and folders.
- **Description:** Lists the contents of a specified folder.
- **Query Parameters:**
  - `folder` (string, optional): The path of the folder to list. If not provided, it lists the root directory of the project.
- **Example:** `GET /file-manager/list?folder=src/common`
- **Responses:**
  - `200 OK`: Returns a list of files and folders.

### 2. Get File Content

- **Endpoint:** `GET /file-manager/content`
- **Summary:** Get file content.
- **Description:** Retrieves the content of a specific file.
- **Query Parameters:**
  - `file` (string, required): The path to the file.
- **Example:** `GET /file-manager/content?file=src/app.module.ts`
- **Responses:**
  - `200 OK`: Returns the file content.
  - `400 Bad Request`: If the `file` parameter is missing.

### 3. Delete a File

- **Endpoint:** `DELETE /file-manager/file`
- **Summary:** Delete a file.
- **Description:** Deletes a specific file.
- **Query Parameters:**
  - `file` (string, required): The path to the file to delete.
- **Example:** `DELETE /file-manager/file?file=src/unwanted-file.ts`
- **Responses:**
  - `200 OK`: If the file is deleted successfully.
  - `400 Bad Request`: If the `file` parameter is missing.

### 4. Delete a Folder

- **Endpoint:** `DELETE /file-manager/folder`
- **Summary:** Delete a folder.
- **Description:** Deletes a specific folder and its contents.
- **Query Parameters:**
  - `folder` (string, required): The path to the folder to delete.
- **Example:** `DELETE /file-manager/folder?folder=src/old-feature`
- **Responses:**
  - `200 OK`: If the folder is deleted successfully.
  - `400 Bad Request`: If the `folder` parameter is missing.

### 5. Rename a File or Folder

- **Endpoint:** `PATCH /file-manager/rename`
- **Summary:** Rename a file or folder.
- **Description:** Renames a file or folder from an old path to a new path.
- **Request Body:**
  ```json
  {
    "oldPath": "/path/to/old/item-name",
    "newPath": "/path/to/new/item-name"
  }
  ```
- **Responses:**
  - `200 OK`: If the rename is successful.
  - `400 Bad Request`: If `oldPath` or `newPath` is missing from the request body.
