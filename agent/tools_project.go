package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// GetProjectContextDef reads the project's full context from the OC Labs API.
var GetProjectContextDef = ToolDefinition{
	Name:        "get_project_context",
	Description: "Read the project's full context including title, summary, status, team members, and all context blocks. Always call this first before answering questions or making changes.",
	InputSchema: GenerateSchema[getProjectContextInput](),
	Function:    getProjectContext,
}

type getProjectContextInput struct{}

func getProjectContext(ctx ToolContext, input json.RawMessage) (string, error) {
	url := fmt.Sprintf("%s/api/v1/projects/%s/context", ctx.BaseURL, ctx.ProjectID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Cookie", fmt.Sprintf("sb-lmhntrqbxrzltppafjnu-auth-token=%s", ctx.AuthToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned %d: %s", resp.StatusCode, string(body))
	}

	return string(body), nil
}

// GetTasksDef lists all tasks for the project from the OC Labs API.
var GetTasksDef = ToolDefinition{
	Name:        "get_tasks",
	Description: "List all tasks for this project including their status, dependencies, and Jira sync state.",
	InputSchema: GenerateSchema[getTasksInput](),
	Function:    getTasks,
}

type getTasksInput struct{}

func getTasks(ctx ToolContext, input json.RawMessage) (string, error) {
	url := fmt.Sprintf("%s/api/v1/projects/%s/tasks", ctx.BaseURL, ctx.ProjectID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Cookie", fmt.Sprintf("sb-lmhntrqbxrzltppafjnu-auth-token=%s", ctx.AuthToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned %d: %s", resp.StatusCode, string(body))
	}

	return string(body), nil
}
