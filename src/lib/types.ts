export interface GenericObject {
  [key: string]: any;
}

export interface GithubFile {
  name: string;
  sha: string;
  download_url: string;
  lastCommit?: GithubCommit;
  lastCommitDate?: string;
}

export interface GithubCommit {
  commit: GithubCommitMeta;
}

export interface GithubCommitMeta {
  committer: GithubCommitterMeta;
}

export interface GithubCommitterMeta {
  date: string;
}
