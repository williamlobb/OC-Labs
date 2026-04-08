package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
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

// ListRepoFilesDef lists file paths from a linked GitHub repository.
var ListRepoFilesDef = ToolDefinition{
	Name:        "list_repo_files",
	Description: "List file paths from a linked GitHub repository so you can discover what to read next. Omit repo_url to use the first linked repo.",
	InputSchema: GenerateSchema[listRepoFilesInput](),
	Function:    listRepoFiles,
}

type listRepoFilesInput struct {
	RepoURL   string `json:"repo_url" jsonschema:"description=GitHub repository URL. Omit to use the first linked repo."`
	Directory string `json:"directory" jsonschema:"description=Optional directory prefix to limit results (e.g. src/app or docs)."`
	Pattern   string `json:"pattern" jsonschema:"description=Optional case-insensitive substring filter on file paths (e.g. route.ts or readme)."`
	Limit     int    `json:"limit" jsonschema:"description=Maximum number of file paths to return. Default 200, maximum 500."`
}

type githubRepoRef struct {
	Owner        string
	Repo         string
	CanonicalURL string
}

type gitTreeResponse struct {
	Tree []struct {
		Path string `json:"path"`
		Type string `json:"type"`
	} `json:"tree"`
	Truncated bool `json:"truncated"`
}

type listRepoFilesResult struct {
	Repo          string   `json:"repo"`
	Directory     string   `json:"directory,omitempty"`
	Pattern       string   `json:"pattern,omitempty"`
	TotalMatches  int      `json:"total_matches"`
	Returned      int      `json:"returned"`
	Truncated     bool     `json:"truncated"`
	GitHubPartial bool     `json:"github_partial"`
	Files         []string `json:"files"`
}

func readRepoFile(ctx ToolContext, input json.RawMessage) (string, error) {
	var params readRepoFileInput
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("failed to parse input: %w", err)
	}

	if params.Path == "" {
		return "", fmt.Errorf("path is required")
	}

	repoRef, err := resolveRepoRef(ctx, params.RepoURL)
	if err != nil {
		return "", err
	}

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", repoRef.Owner, repoRef.Repo, strings.TrimPrefix(params.Path, "/"))

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
		return "", fmt.Errorf("file %q not found in %s/%s", params.Path, repoRef.Owner, repoRef.Repo)
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

func listRepoFiles(ctx ToolContext, input json.RawMessage) (string, error) {
	var params listRepoFilesInput
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("failed to parse input: %w", err)
	}

	repoRef, err := resolveRepoRef(ctx, params.RepoURL)
	if err != nil {
		return "", err
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
	}

	entries, githubTruncated, err := fetchRepoTree(repoRef.Owner, repoRef.Repo)
	if err != nil {
		return "", err
	}

	dir := strings.Trim(strings.TrimPrefix(params.Directory, "/"), "/")
	pattern := strings.ToLower(strings.TrimSpace(params.Pattern))
	prefix := ""
	if dir != "" {
		prefix = dir + "/"
	}

	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.Type != "blob" {
			continue
		}
		if prefix != "" && !(entry.Path == dir || strings.HasPrefix(entry.Path, prefix)) {
			continue
		}
		if pattern != "" && !strings.Contains(strings.ToLower(entry.Path), pattern) {
			continue
		}
		files = append(files, entry.Path)
	}
	sort.Strings(files)

	total := len(files)
	truncated := false
	if total > limit {
		files = files[:limit]
		truncated = true
	}

	result := listRepoFilesResult{
		Repo:          fmt.Sprintf("%s/%s", repoRef.Owner, repoRef.Repo),
		Directory:     dir,
		Pattern:       params.Pattern,
		TotalMatches:  total,
		Returned:      len(files),
		Truncated:     truncated,
		GitHubPartial: githubTruncated,
		Files:         files,
	}

	raw, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to encode result: %w", err)
	}
	return string(raw), nil
}

func resolveRepoRef(ctx ToolContext, provided string) (githubRepoRef, error) {
	repoInput := strings.TrimSpace(provided)
	if repoInput == "" {
		if len(ctx.GitHubRepos) == 0 {
			return githubRepoRef{}, fmt.Errorf("no repo_url provided and no linked GitHub repos on this project")
		}
		repoInput = ctx.GitHubRepos[0]
	}
	return parseGitHubRepoRef(repoInput)
}

func parseGitHubRepoRef(repoInput string) (githubRepoRef, error) {
	normalized := strings.TrimSpace(repoInput)
	normalized = strings.TrimSuffix(normalized, "/")
	normalized = strings.TrimSuffix(normalized, ".git")
	if normalized == "" {
		return githubRepoRef{}, fmt.Errorf("invalid GitHub repository value %q", repoInput)
	}

	owner := ""
	repo := ""

	if strings.Contains(normalized, "github.com") || strings.Contains(normalized, "://") {
		candidate := normalized
		if !strings.Contains(candidate, "://") {
			candidate = "https://" + candidate
		}
		u, err := url.Parse(candidate)
		if err != nil {
			return githubRepoRef{}, fmt.Errorf("invalid GitHub URL %q: %w", repoInput, err)
		}

		host := strings.ToLower(u.Hostname())
		if host != "github.com" && host != "www.github.com" {
			return githubRepoRef{}, fmt.Errorf("invalid GitHub URL %q: expected github.com host", repoInput)
		}

		parts := strings.Split(strings.Trim(u.Path, "/"), "/")
		if len(parts) < 2 {
			return githubRepoRef{}, fmt.Errorf("invalid GitHub URL %q: expected format https://github.com/owner/repo", repoInput)
		}
		owner = parts[0]
		repo = parts[1]
	} else {
		parts := strings.Split(normalized, "/")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return githubRepoRef{}, fmt.Errorf("invalid repository %q: expected owner/repo or full GitHub URL", repoInput)
		}
		owner = parts[0]
		repo = parts[1]
	}

	repo = strings.TrimSuffix(repo, ".git")
	repo = filepath.Clean(repo)
	if owner == "" || repo == "" || strings.Contains(owner, "..") || strings.Contains(repo, "..") || repo == "." {
		return githubRepoRef{}, fmt.Errorf("invalid repository %q: could not extract owner and repo", repoInput)
	}

	return githubRepoRef{
		Owner:        owner,
		Repo:         repo,
		CanonicalURL: fmt.Sprintf("https://github.com/%s/%s", owner, repo),
	}, nil
}

func fetchRepoTree(owner, repo string) (entries []struct {
	Path string `json:"path"`
	Type string `json:"type"`
}, githubTruncated bool, err error) {
	repoMetaURL := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	metaReq, err := http.NewRequest(http.MethodGet, repoMetaURL, nil)
	if err != nil {
		return nil, false, fmt.Errorf("failed to build request: %w", err)
	}
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		metaReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	metaResp, err := http.DefaultClient.Do(metaReq)
	if err != nil {
		return nil, false, fmt.Errorf("request failed: %w", err)
	}
	defer metaResp.Body.Close()

	metaBody, err := io.ReadAll(metaResp.Body)
	if err != nil {
		return nil, false, fmt.Errorf("failed to read response body: %w", err)
	}
	if metaResp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("GitHub API returned %d: %s", metaResp.StatusCode, string(metaBody))
	}

	var repoMeta struct {
		DefaultBranch string `json:"default_branch"`
	}
	if err := json.Unmarshal(metaBody, &repoMeta); err != nil {
		return nil, false, fmt.Errorf("failed to parse repository metadata: %w", err)
	}
	branch := repoMeta.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	treeURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1", owner, repo, url.PathEscape(branch))
	treeReq, err := http.NewRequest(http.MethodGet, treeURL, nil)
	if err != nil {
		return nil, false, fmt.Errorf("failed to build request: %w", err)
	}
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		treeReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	treeResp, err := http.DefaultClient.Do(treeReq)
	if err != nil {
		return nil, false, fmt.Errorf("request failed: %w", err)
	}
	defer treeResp.Body.Close()

	treeBody, err := io.ReadAll(treeResp.Body)
	if err != nil {
		return nil, false, fmt.Errorf("failed to read response body: %w", err)
	}
	if treeResp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("GitHub API returned %d: %s", treeResp.StatusCode, string(treeBody))
	}

	var tree gitTreeResponse
	if err := json.Unmarshal(treeBody, &tree); err != nil {
		return nil, false, fmt.Errorf("failed to parse repository tree: %w", err)
	}

	return tree.Tree, tree.Truncated, nil
}
