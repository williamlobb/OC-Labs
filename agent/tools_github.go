package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// ReadRepoFileDef fetches any file from a linked GitHub repository by path.
// To read the README, pass path "README.md".
var ReadRepoFileDef = ToolDefinition{
	Name:        "read_repo_file",
	Description: "Read a file from a linked GitHub repository by path (e.g. README.md, CLAUDE.md, src/app/page.tsx). Omit repo_url to use the first linked repo.",
	InputSchema: GenerateSchema[readRepoFileInput](),
	Function:    readRepoFile,
}

type readRepoFileInput struct {
	Path    string `json:"path" jsonschema:"description=File path within the repository (e.g. README.md or src/app/page.tsx),required=true"`
	RepoURL string `json:"repo_url" jsonschema:"description=GitHub repository URL. Omit to use the first linked repo."`
}

func readRepoFile(ctx ToolContext, input json.RawMessage) (string, error) {
	var params readRepoFileInput
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("failed to parse input: %w", err)
	}

	if params.Path == "" {
		return "", fmt.Errorf("path is required")
	}

	repoURL := params.RepoURL
	if repoURL == "" {
		if len(ctx.GitHubRepos) == 0 {
			return "", fmt.Errorf("no repo_url provided and no linked GitHub repos on this project")
		}
		repoURL = ctx.GitHubRepos[0]
	}

	owner, repo, err := extractOwnerRepo(repoURL)
	if err != nil {
		return "", err
	}

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repo, strings.TrimPrefix(params.Path, "/"))

	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3.raw")

	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode == http.StatusNotFound {
		return "", fmt.Errorf("file %q not found in %s/%s", params.Path, owner, repo)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	content := string(body)
	if len(content) > 8000 {
		content = content[:8000] + "\n... [truncated]"
	}

	return content, nil
}

// extractOwnerRepo parses a GitHub URL and returns owner and repo name.
func extractOwnerRepo(repoURL string) (owner, repo string, err error) {
	repoURL = strings.TrimSuffix(repoURL, "/")
	repoURL = strings.TrimSuffix(repoURL, ".git")

	if idx := strings.Index(repoURL, "://"); idx != -1 {
		repoURL = repoURL[idx+3:]
	}

	parts := strings.Split(repoURL, "/")
	if len(parts) < 3 {
		return "", "", fmt.Errorf("invalid GitHub URL %q: expected format https://github.com/owner/repo", repoURL)
	}

	owner = parts[1]
	repo = parts[2]

	if owner == "" || repo == "" {
		return "", "", fmt.Errorf("invalid GitHub URL %q: could not extract owner and repo", repoURL)
	}

	return owner, repo, nil
}
