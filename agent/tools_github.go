package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// ReadRepoReadmeDef fetches the README from a linked GitHub repository.
var ReadRepoReadmeDef = ToolDefinition{
	Name:        "read_repo_readme",
	Description: "Read the README from a linked GitHub repository. Optionally pass a specific repo_url, or omit to read the first linked repo.",
	InputSchema: GenerateSchema[readRepoReadmeInput](),
	Function:    readRepoReadme,
}

type readRepoReadmeInput struct {
	RepoURL string `json:"repo_url" jsonschema:"description=GitHub repository URL (e.g. https://github.com/owner/repo). Omit to use the first linked repo."`
}

func readRepoReadme(ctx ToolContext, input json.RawMessage) (string, error) {
	var params readRepoReadmeInput
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("failed to parse input: %w", err)
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

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/readme", owner, repo)

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

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	content := string(body)
	if len(content) > 8000 {
		content = content[:8000]
	}

	return content, nil
}

// extractOwnerRepo parses a GitHub URL and returns owner and repo name.
// Accepts formats like https://github.com/owner/repo or github.com/owner/repo.
func extractOwnerRepo(repoURL string) (owner, repo string, err error) {
	repoURL = strings.TrimSuffix(repoURL, "/")
	repoURL = strings.TrimSuffix(repoURL, ".git")

	// Strip scheme if present
	if idx := strings.Index(repoURL, "://"); idx != -1 {
		repoURL = repoURL[idx+3:]
	}

	// Remaining: github.com/owner/repo
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
