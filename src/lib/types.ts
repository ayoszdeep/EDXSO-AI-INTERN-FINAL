export type DataSourceMode =
  | "labelled_test_dataset"
  | "supplied_url_manual"
  | "authorized_provider";

export type SearchInputMode = "keyword" | "post_url";

export type AiMethod =
  | "local_semantic_v1"
  | "gemini_hybrid"
  | "openai_hybrid";

export type PersonaTier =
  | "Primary Decision-Maker / Advisor"
  | "Ecosystem Multiplier"
  | "Adjacent EdTech Operator"
  | "Low Fit";

export interface LinkedInPost {
  id: string;
  url: string;
  canonicalUrl: string;
  authorName: string;
  authorRole: string;
  authorProfileUrl: string;
  publishedAt: string;
  snippet: string;
  fullText: string;
  topics: string[];
  engagementStats: {
    reactions: number;
    comments: number;
  };
  relevanceToQuery: number;
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface RawCommentRecord {
  commentId: string;
  postId: string;
  postUrl: string;
  authorName: string;
  authorProfileUrl: string;
  headline: string;
  currentRole: string;
  organization: string;
  location: string | null;
  commentText: string;
  commentedAt: string;
  experienceSummary: string;
  skills: string[];
  schoolNetworkSignals: string[];
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface CandidateProfileRecord {
  id: string;
  name: string;
  linkedinUrl: string;
  headline: string;
  currentRole: string;
  organization: string;
  location: string | null;
  experienceSummary: string;
  skills: string[];
  schoolNetworkSignals: string[];
  recentTopics: string[];
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface ScoreBreakdown {
  ecosystemFit: number; // 0-35
  networkReach: number; // 0-25
  semanticAlignment: number; // 0-25
  engagementOrSimilaritySignal: number; // 0-15
  total: number; // 0-100
}

export interface CommentReference {
  postId: string;
  postUrl: string;
  text: string;
  commentedAt: string;
}

export interface AnalyzedCommenter {
  id: string;
  category: "original_commenter";
  name: string;
  linkedinUrl: string;
  canonicalLinkedinUrl: string;
  headline: string;
  currentRole: string;
  organization: string;
  location: string | null;
  associatedPostUrls: string[];
  associatedPostIds: string[];
  comments: CommentReference[];
  commentCount: number;
  schoolEcosystemIndicators: string[];
  relevanceScore: number;
  scoreBreakdown: ScoreBreakdown;
  relevanceExplanation: string;
  personaTier: PersonaTier;
  aiMethod: AiMethod;
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface SeedMatchReference {
  seedCommenterId: string;
  seedCommenterName: string;
  seedLinkedinUrl: string;
  similarityScore: number; // 0-100
  sharedSignals: string[];
  rationale: string;
}

export interface LookalikeProfile {
  id: string;
  category: "ai_lookalike_profile";
  name: string;
  linkedinUrl: string;
  canonicalLinkedinUrl: string;
  headline: string;
  currentRole: string;
  organization: string;
  location: string | null;
  experienceSummary: string;
  skills: string[];
  schoolEcosystemIndicators: string[];
  seedProfiles: SeedMatchReference[];
  similarityScore: number; // 0-100 (max/weighted similarity to top seeds)
  similarityEvidence: string[];
  relevanceScore: number; // 0-100 (EDXSO outreach rank)
  scoreBreakdown: ScoreBreakdown;
  relevanceExplanation: string;
  personaTier: PersonaTier;
  aiMethod: AiMethod;
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface ManualEngagementInput {
  postUrl: string;
  postAuthorName?: string;
  postAuthorRole?: string;
  postAuthorProfileUrl?: string;
  postDate?: string;
  postSnippet?: string;
  commenters?: Array<{
    name: string;
    linkedinUrl: string;
    currentRole?: string;
    organization?: string;
    location?: string;
    headline?: string;
    commentText?: string;
  }>;
}

export interface DiscoveryRequest {
  mode: SearchInputMode;
  query?: string;
  postUrl?: string;
  dataSource?: DataSourceMode;
  maxPosts?: number;
  maxLookalikes?: number;
  manualInput?: ManualEngagementInput;
  apiKeys?: {
    geminiApiKey?: string;
    openAiApiKey?: string;
    serperApiKey?: string;
    tavilyApiKey?: string;
  };
}

export interface DiscoveryResult {
  runId: string;
  executedAt: string;
  inputMode: SearchInputMode;
  queryOrUrl: string;
  dataSource: DataSourceMode;
  isTestData: boolean;
  complianceNotice: string;
  aiMethod: AiMethod;
  posts: LinkedInPost[];
  stats: {
    postsFound: number;
    rawCommentsExtracted: number;
    uniqueCommenters: number;
    deduplicatedDuplicatesRemoved: number;
    lookalikesDiscovered: number;
    avgCommenterScore: number;
    avgLookalikeScore: number;
  };
  commenters: AnalyzedCommenter[];
  lookalikes: LookalikeProfile[];
  methodology: {
    summary: string;
    embeddingDimensions: string[];
    weights: {
      ecosystemFit: number;
      networkReach: number;
      semanticAlignment: number;
      engagementOrSimilaritySignal: number;
    };
    compliancePathToProduction: string[];
  };
}
