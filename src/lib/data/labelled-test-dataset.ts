import {
  CandidateProfileRecord,
  LinkedInPost,
  RawCommentRecord,
} from "@/lib/types";

/**
 * CLEARLY LABELLED TEST DATASET (Evaluation Fixture)
 *
 * Notice: LinkedIn does not provide a public API for unrestricted phrase-based
 * post search or comment retrieval. All records in this file are synthetic,
 * clearly labelled test fixtures (`isTestData: true`,
 * `dataSource: "labelled_test_dataset"`) built specifically to demonstrate
 * and verify EDXSO's 6-stage workflow without bypassing LinkedIn auth or
 * fabricating claims about live scraped individuals.
 */

export const TEST_DATASET_NOTICE =
  "Clearly Labelled Test Dataset (Evaluation Mode): Profiles, posts, and comments below are structured test fixtures for workflow evaluation—not live scraped LinkedIn records. Connect an authorized data provider or import user-supplied post data for live runs.";

export const TEST_LINKEDIN_POSTS: LinkedInPost[] = [
  {
    id: "post-k12-01",
    url: "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    authorName: "Rohan Deshmukh (Test Fixture)",
    authorRole: "K12 EdTech GTM Advisor & Former Regional School Director",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-rohan-deshmukh-k12",
    publishedAt: "2026-11-18T09:30:00Z",
    snippet:
      "Selling into K12 schools is never a single-stakeholder motion. Cold demos rarely pass the Academic Coordinator unless a Trustee or former Principal vouches for school-level readiness.",
    fullText:
      "Selling into K12 schools is never a single-stakeholder motion. Over 40+ CBSE and ICSE school deployments this year, cold demos rarely passed the Academic Coordinator unless a Managing Trustee, School Director, or former Principal vouched for operational ROI, teacher adoption, and NEP 2020 alignment. In K12 B2B sales, ecosystem trust beats outbound volume every single quarter.",
    topics: [
      "K12 B2B Sales",
      "School Procurement",
      "Trustees & Principals",
      "CBSE/ICSE Networks",
      "Channel Partnerships",
    ],
    engagementStats: { reactions: 214, comments: 46 },
    relevanceToQuery: 0.98,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-02",
    url: "https://www.linkedin.com/posts/demo-school-networks_k12-procurement-edtech-sales-activity-7263881204912002",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-school-networks_k12-procurement-edtech-sales-activity-7263881204912002",
    authorName: "Meenakshi Iyer (Test Fixture)",
    authorRole: "Independent K12 School Transformation Consultant",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-meenakshi-iyer-edu",
    publishedAt: "2026-11-15T11:15:00Z",
    snippet:
      "Why 70% of K12 B2B sales cycles stall between October and January: vendors pitch software features instead of solving multi-campus governance and parent fee-retention outcomes.",
    fullText:
      "Why 70% of K12 B2B sales cycles stall between October and January: vendors pitch software features instead of solving multi-campus governance, board compliance, and parent retention outcomes. School owners and trustees evaluate partners through trusted peer advisors who serve multiple schools across the state.",
    topics: [
      "K12 B2B Sales",
      "School Owners",
      "Multi-Campus Governance",
      "EdTech Buying Cycle",
    ],
    engagementStats: { reactions: 178, comments: 34 },
    relevanceToQuery: 0.95,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-03",
    url: "https://www.linkedin.com/posts/demo-edtech-partners_school-distribution-k12-b2b-activity-7263120094813003",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-edtech-partners_school-distribution-k12-b2b-activity-7263120094813003",
    authorName: "Siddharth Kulkarni (Test Fixture)",
    authorRole: "Founder, EduBridge School Network Advisory",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-siddharth-kulkarni",
    publishedAt: "2026-11-11T07:45:00Z",
    snippet:
      "Field-tested playbook for K12 B2B sales in Tier-2 & Tier-3 cities: partner with retired principals, academic auditors, and school consortium consultants who already hold boardroom trust.",
    fullText:
      "Field-tested playbook for K12 B2B sales in Tier-2 & Tier-3 cities: hiring 20 SDRs rarely works. What works is partnering with retired principals, accreditation auditors, and regional school consultants who advise 10-30 independent schools and already sit in trustee budget reviews.",
    topics: [
      "K12 B2B Sales",
      "Retired Principals",
      "School Consultants",
      "Tier-2/3 Schools",
      "Partner GTM",
    ],
    engagementStats: { reactions: 309, comments: 52 },
    relevanceToQuery: 0.96,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-04",
    url: "https://www.linkedin.com/posts/demo-principal-council_k12-leadership-erp-adoption-activity-7262755401924004",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-principal-council_k12-leadership-erp-adoption-activity-7262755401924004",
    authorName: "Dr. Nandini Chatterjee (Test Fixture)",
    authorRole: "Former Principal & Managing Trustee, Sunrise K12 Trust",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-nandini-chatterjee",
    publishedAt: "2026-11-08T14:20:00Z",
    snippet:
      "As a former Principal now advising 14 K12 trusts, here is what makes a B2B education vendor credible in our evaluation committee: teacher-first onboarding and zero hidden lock-in.",
    fullText:
      "As a former Principal now advising 14 K12 school trusts, here is what makes a B2B education vendor credible in our evaluation committee: transparent annual pricing, teacher-first onboarding, and reference deployments across peer schools in our association.",
    topics: [
      "School Trust Evaluation",
      "K12 B2B Procurement",
      "Former Principals",
      "Teacher Onboarding",
    ],
    engagementStats: { reactions: 265, comments: 41 },
    relevanceToQuery: 0.93,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-05",
    url: "https://www.linkedin.com/posts/demo-school-founders_k12-b2b-partnerships-nep2020-activity-7262049182735005",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-school-founders_k12-b2b-partnerships-nep2020-activity-7262049182735005",
    authorName: "Vikramjit Singh Gill (Test Fixture)",
    authorRole: "Director of Multi-School Operations, NorthStar Academies",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-vikramjit-gill",
    publishedAt: "2026-11-04T10:00:00Z",
    snippet:
      "Building an education ecosystem network across 22 K12 campuses taught us one lesson: every successful B2B school rollout starts with principal peer validation and district-level champions.",
    fullText:
      "Building an education ecosystem network across 22 K12 campuses taught us one lesson: every successful B2B school rollout starts with principal peer validation, school federation workshops, and district-level education entrepreneurs who connect operators with vetted solutions.",
    topics: [
      "K12 B2B Sales",
      "Multi-School Operations",
      "School Federations",
      "Education Entrepreneurs",
    ],
    engagementStats: { reactions: 192, comments: 29 },
    relevanceToQuery: 0.91,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-06",
    url: "https://www.linkedin.com/posts/demo-curriculum-lab_stem-labs-k12-schools-activity-7261500293846006",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-curriculum-lab_stem-labs-k12-schools-activity-7261500293846006",
    authorName: "Ananya Krishnan (Test Fixture)",
    authorRole: "Head of Curriculum Partnerships, STEMForge India",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-ananya-krishnan",
    publishedAt: "2026-10-29T08:10:00Z",
    snippet:
      "How experiential STEM labs win approvals from K12 school boards and independent school associations during Q4 academic planning.",
    fullText:
      "How experiential STEM labs win approvals from K12 school boards and independent school associations during Q4 academic planning. Alignment with NCF and teacher training certifications unlocks faster school trustee sign-off.",
    topics: ["STEM Labs", "K12 Curriculum", "School Boards", "Q4 Planning"],
    engagementStats: { reactions: 118, comments: 19 },
    relevanceToQuery: 0.78,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "post-k12-07",
    url: "https://www.linkedin.com/posts/demo-higher-ed_university-admissions-crm-activity-7260900182737007",
    canonicalUrl:
      "https://www.linkedin.com/posts/demo-higher-ed_university-admissions-crm-activity-7260900182737007",
    authorName: "Prof. Harish Menon (Test Fixture)",
    authorRole: "Dean of Admissions, Coastal Tech University",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-harish-menon",
    publishedAt: "2026-10-21T16:40:00Z",
    snippet:
      "Reflections on higher-education university enrollment funnels and postgraduate student counseling automation.",
    fullText:
      "Reflections on higher-education university enrollment funnels, NAAC accreditation reporting, and postgraduate student counseling automation for engineering colleges.",
    topics: ["Higher Education", "University Admissions", "NAAC"],
    engagementStats: { reactions: 94, comments: 12 },
    relevanceToQuery: 0.32,
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
];

export const TEST_RAW_COMMENTS: RawCommentRecord[] = [
  // Post 1 comments
  {
    commentId: "cmt-001",
    postId: "post-k12-01",
    postUrl:
      "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    authorName: "Dr. Kavita Sharma (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-dr-kavita-sharma-k12/",
    headline:
      "Former CBSE Principal (18 yrs) | Senior School Transformation Advisor | NEP 2020 Mentor to 25+ K12 Schools",
    currentRole: "Principal Advisor & School Audit Consultant",
    organization: "VidyaSetu School Advisory",
    location: "Bengaluru, Karnataka, India",
    commentText:
      "Spot on, Rohan. Across the 25 K12 schools I mentor, trustees ask me first before scheduling any ERP or curriculum demo. Warm peer introduction cuts the 6-month cycle in half.",
    commentedAt: "2026-11-18T11:05:00Z",
    experienceSummary:
      "18 years as CBSE School Principal, now independent school advisor guiding boards and trustees on academic quality, teacher upskilling, and EdTech vendor selection across 25+ K12 institutions.",
    skills: [
      "School Leadership",
      "CBSE Compliance",
      "Trustee Advisory",
      "EdTech Evaluation",
      "Multi-School Mentoring",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 25+ K12 schools",
      "Direct Trustee & Chairman access",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-002",
    postId: "post-k12-01",
    postUrl:
      "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    authorName: "Rajeshwar Nair (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-rajeshwar-nair-trustee?trk=public_post",
    headline:
      "Managing Trustee & School Director | Governing 11 K12 Campuses across Kerala & Tamil Nadu",
    currentRole: "Managing Trustee & Executive Director",
    organization: "Malabar Horizon Educational Trust",
    location: "Kochi, Kerala, India",
    commentText:
      "As a trustee managing 11 campuses, we reject generic SaaS pitches weekly. We engage vendors recommended by fellow school owners or principals we trust.",
    commentedAt: "2026-11-18T12:40:00Z",
    experienceSummary:
      "Oversees governance, capital budgeting, and academic partnerships across 11 K12 campuses (14,000+ students). Active speaker at Independent Schools Federation.",
    skills: [
      "School Governance",
      "Multi-Campus Strategy",
      "K12 Procurement",
      "Board Leadership",
    ],
    schoolNetworkSignals: [
      "Managing Trustee",
      "School Director (11 campuses)",
      "Federation Board Member",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-003",
    postId: "post-k12-01",
    postUrl:
      "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    authorName: "Pallavi Joshi (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-pallavi-joshi-edtech",
    headline:
      "Education Entrepreneur & Founder @ SchoolConnect Guild | Connecting 180+ K12 Principals",
    currentRole: "Founder & Managing Partner",
    organization: "SchoolConnect Guild",
    location: "Pune, Maharashtra, India",
    commentText:
      "This is exactly why we built regional principal roundtables. When 4 school directors validate a solution together, adoption across neighbouring schools follows naturally.",
    commentedAt: "2026-11-18T14:15:00Z",
    experienceSummary:
      "Education entrepreneur running peer roundtables and partner distribution for K12 school owners and principals across Maharashtra and Gujarat.",
    skills: [
      "K12 B2B Partnerships",
      "Principal Communities",
      "School Ecosystem GTM",
      "Education Entrepreneurship",
    ],
    schoolNetworkSignals: [
      "Education Entrepreneur",
      "180+ K12 Principal Network",
      "Multi-School Channel Builder",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-004",
    postId: "post-k12-01",
    postUrl:
      "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001",
    authorName: "Arvind Subramanian (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-arvind-subramanian-saas",
    headline: "Enterprise Account Executive | K12 School ERP & Assessment SaaS",
    currentRole: "Senior Enterprise Account Executive (K12)",
    organization: "LearnSphere Cloud",
    location: "Hyderabad, Telangana, India",
    commentText:
      "Agreed! Our close rate jumped 3x once we stopped cold-calling school front desks and started co-hosting workshops with education consultants.",
    commentedAt: "2026-11-18T16:10:00Z",
    experienceSummary:
      "7 years in K12 B2B SaaS sales across South India, selling school ERP, fee management, and parent communication platforms to private school groups.",
    skills: ["K12 B2B Sales", "SaaS GTM", "School ERP", "Channel Sales"],
    schoolNetworkSignals: ["K12 B2B Sales Operator", "Works with School Groups"],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },

  // Post 2 comments (includes duplicate Dr. Kavita Sharma + new profiles)
  {
    commentId: "cmt-005",
    postId: "post-k12-02",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-networks_k12-procurement-edtech-sales-activity-7263881204912002",
    authorName: "Dr. Kavita Sharma (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-dr-kavita-sharma-k12",
    headline:
      "Former CBSE Principal (18 yrs) | Senior School Transformation Advisor | NEP 2020 Mentor to 25+ K12 Schools",
    currentRole: "Principal Advisor & School Audit Consultant",
    organization: "VidyaSetu School Advisory",
    location: "Bengaluru, Karnataka, India",
    commentText:
      "The October-January budgeting window is real, Meenakshi. Boards finalize next academic year vendor budgets in Q4—anyone arriving in March is already too late.",
    commentedAt: "2026-11-15T13:20:00Z",
    experienceSummary:
      "18 years as CBSE School Principal, now independent school advisor guiding boards and trustees on academic quality, teacher upskilling, and EdTech vendor selection across 25+ K12 institutions.",
    skills: [
      "School Leadership",
      "CBSE Compliance",
      "Trustee Advisory",
      "EdTech Evaluation",
      "Multi-School Mentoring",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 25+ K12 schools",
      "Direct Trustee & Chairman access",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-006",
    postId: "post-k12-02",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-networks_k12-procurement-edtech-sales-activity-7263881204912002",
    authorName: "Farhan Merchant (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-farhan-merchant-schools",
    headline:
      "School Owner & Director | Advisor to Independent ICSE & IB Schools | K12 Growth Partner",
    currentRole: "Director & Co-Owner",
    organization: "Crestwood International Schools",
    location: "Mumbai, Maharashtra, India",
    commentText:
      "We run 4 campuses and review every B2B tool against teacher workload and parent trust. Consultants who understand school economics always get a hearing.",
    commentedAt: "2026-11-15T15:05:00Z",
    experienceSummary:
      "Co-owner and Director of 4 ICSE/IB K12 schools in Mumbai MMR, also advising new school founders on infrastructure, governance, and technology stack.",
    skills: [
      "School Ownership",
      "ICSE/IB Operations",
      "Vendor Evaluation",
      "School Founder Mentoring",
    ],
    schoolNetworkSignals: [
      "School Owner & Director",
      "Multi-Campus Operator",
      "Advises New School Founders",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-007",
    postId: "post-k12-02",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-networks_k12-procurement-edtech-sales-activity-7263881204912002",
    authorName: "Sunita Verma (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-sunita-verma-corp-ld",
    headline:
      "Corporate L&D Instructional Designer | Enterprise Workforce Skilling",
    currentRole: "Senior L&D Specialist",
    organization: "FinCore Global Services",
    location: "Gurugram, Haryana, India",
    commentText:
      "Enterprise procurement cycles in corporate L&D behave very similarly in Q4 budget lock-in.",
    commentedAt: "2026-11-15T17:45:00Z",
    experienceSummary:
      "10 years designing corporate compliance and leadership training for banking and IT teams; no direct K12 school operations background.",
    skills: ["Corporate L&D", "LMS Administration", "Instructional Design"],
    schoolNetworkSignals: [],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },

  // Post 3 comments (includes duplicate Pallavi Joshi + Rajeshwar Nair + new profiles)
  {
    commentId: "cmt-008",
    postId: "post-k12-03",
    postUrl:
      "https://www.linkedin.com/posts/demo-edtech-partners_school-distribution-k12-b2b-activity-7263120094813003",
    authorName: "Pallavi Joshi (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-pallavi-joshi-edtech/",
    headline:
      "Education Entrepreneur & Founder @ SchoolConnect Guild | Connecting 180+ K12 Principals",
    currentRole: "Founder & Managing Partner",
    organization: "SchoolConnect Guild",
    location: "Pune, Maharashtra, India",
    commentText:
      "Tier-2 school federations are massively underserved by traditional EdTech reps. Local academic advisors carry 10x more credibility than cold email cadences.",
    commentedAt: "2026-11-11T09:30:00Z",
    experienceSummary:
      "Education entrepreneur running peer roundtables and partner distribution for K12 school owners and principals across Maharashtra and Gujarat.",
    skills: [
      "K12 B2B Partnerships",
      "Principal Communities",
      "School Ecosystem GTM",
      "Education Entrepreneurship",
    ],
    schoolNetworkSignals: [
      "Education Entrepreneur",
      "180+ K12 Principal Network",
      "Multi-School Channel Builder",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-009",
    postId: "post-k12-03",
    postUrl:
      "https://www.linkedin.com/posts/demo-edtech-partners_school-distribution-k12-b2b-activity-7263120094813003",
    authorName: "Col. Rameshwar Rao (Retd.) (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-rameshwar-rao-schools",
    headline:
      "Former Sainik & CBSE School Principal | Director of School Accreditation & Network Operations",
    currentRole: "Senior Education Consultant & Former Principal",
    organization: "Deccan School Quality Council",
    location: "Jaipur, Rajasthan, India",
    commentText:
      "Retired principals understand both board politics and ground-level classroom realities. Happy to share how our 32-school consortium evaluates partner tools.",
    commentedAt: "2026-11-11T11:50:00Z",
    experienceSummary:
      "22 years leading CBSE residential and day schools, now advising 32 independent K12 schools across Rajasthan and MP on governance, accreditation, and digital readiness.",
    skills: [
      "Former Principal",
      "School Accreditation",
      "Multi-School Consulting",
      "Trustee Relations",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 32-school consortium",
      "Decision-maker relationship network",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-010",
    postId: "post-k12-03",
    postUrl:
      "https://www.linkedin.com/posts/demo-edtech-partners_school-distribution-k12-b2b-activity-7263120094813003",
    authorName: "Neha Bhatia (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-neha-bhatia-k12-advisor",
    headline:
      "K12 School Setup & Growth Consultant | Partnering with 40+ School Founders & Trustees",
    currentRole: "Principal Consultant - K12 Strategy",
    organization: "Bhatia EduVentures",
    location: "Chandigarh, India",
    commentText:
      "Strong point, Siddharth. In Punjab and Haryana, regional school consultants often sit directly on trust advisory committees for new campus technology.",
    commentedAt: "2026-11-11T14:05:00Z",
    experienceSummary:
      "Independent K12 school setup and academic growth consultant working with 40+ private school promoters, trustees, and K12 franchisors in North India.",
    skills: [
      "School Setup Consulting",
      "Promoter & Trustee Advisory",
      "K12 Franchising",
      "B2B Ecosystem Partnerships",
    ],
    schoolNetworkSignals: [
      "Education Consultant",
      "Works with 40+ School Founders",
      "Trust Advisory Committee Access",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },

  // Post 4 comments (includes duplicate Dr. Kavita Sharma + Farhan Merchant + new profile)
  {
    commentId: "cmt-011",
    postId: "post-k12-04",
    postUrl:
      "https://www.linkedin.com/posts/demo-principal-council_k12-leadership-erp-adoption-activity-7262755401924004",
    authorName: "Dr. Kavita Sharma (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-dr-kavita-sharma-k12?utm_source=feed",
    headline:
      "Former CBSE Principal (18 yrs) | Senior School Transformation Advisor | NEP 2020 Mentor to 25+ K12 Schools",
    currentRole: "Principal Advisor & School Audit Consultant",
    organization: "VidyaSetu School Advisory",
    location: "Bengaluru, Karnataka, India",
    commentText:
      "Teacher-first onboarding is non-negotiable. Whenever I advise a trust on ERP or assessment partners, I always ask for two reference principals first.",
    commentedAt: "2026-11-08T16:00:00Z",
    experienceSummary:
      "18 years as CBSE School Principal, now independent school advisor guiding boards and trustees on academic quality, teacher upskilling, and EdTech vendor selection across 25+ K12 institutions.",
    skills: [
      "School Leadership",
      "CBSE Compliance",
      "Trustee Advisory",
      "EdTech Evaluation",
      "Multi-School Mentoring",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 25+ K12 schools",
      "Direct Trustee & Chairman access",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-012",
    postId: "post-k12-04",
    postUrl:
      "https://www.linkedin.com/posts/demo-principal-council_k12-leadership-erp-adoption-activity-7262755401924004",
    authorName: "Deepak Malhotra (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-deepak-malhotra-schools",
    headline:
      "VP School Partnerships @ EduGrid | Building K12 Channel Alliances across 500+ Schools",
    currentRole: "Vice President - School Partnerships",
    organization: "EduGrid Learning Systems",
    location: "New Delhi, Delhi, India",
    commentText:
      "Reference deployments with peer principals inside the same city cluster are the single biggest accelerator in K12 B2B onboarding.",
    commentedAt: "2026-11-08T17:30:00Z",
    experienceSummary:
      "Leads institutional partnerships and school network alliances across 500+ K12 schools in NCR and UP, collaborating closely with school directors and academic heads.",
    skills: [
      "School Network Partnerships",
      "K12 B2B GTM",
      "Principal Engagement",
      "Channel Strategy",
    ],
    schoolNetworkSignals: [
      "Multi-School Partnership Leader",
      "500+ K12 School Network Reach",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },

  // Post 5 comments (includes duplicate Rajeshwar Nair + Col. Rameshwar Rao + new profile)
  {
    commentId: "cmt-013",
    postId: "post-k12-05",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-founders_k12-b2b-partnerships-nep2020-activity-7262049182735005",
    authorName: "Rajeshwar Nair (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-rajeshwar-nair-trustee",
    headline:
      "Managing Trustee & School Director | Governing 11 K12 Campuses across Kerala & Tamil Nadu",
    currentRole: "Managing Trustee & Executive Director",
    organization: "Malabar Horizon Educational Trust",
    location: "Kochi, Kerala, India",
    commentText:
      "School federation workshops are where real partnerships begin, Vikramjit. Peer trust among directors matters far more than slide decks.",
    commentedAt: "2026-11-04T12:15:00Z",
    experienceSummary:
      "Oversees governance, capital budgeting, and academic partnerships across 11 K12 campuses (14,000+ students). Active speaker at Independent Schools Federation.",
    skills: [
      "School Governance",
      "Multi-Campus Strategy",
      "K12 Procurement",
      "Board Leadership",
    ],
    schoolNetworkSignals: [
      "Managing Trustee",
      "School Director (11 campuses)",
      "Federation Board Member",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-014",
    postId: "post-k12-05",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-founders_k12-b2b-partnerships-nep2020-activity-7262049182735005",
    authorName: "Col. Rameshwar Rao (Retd.) (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-rameshwar-rao-schools/",
    headline:
      "Former Sainik & CBSE School Principal | Director of School Accreditation & Network Operations",
    currentRole: "Senior Education Consultant & Former Principal",
    organization: "Deccan School Quality Council",
    location: "Jaipur, Rajasthan, India",
    commentText:
      "District-level principal champions are the backbone of sustainable school transformation.",
    commentedAt: "2026-11-04T15:40:00Z",
    experienceSummary:
      "22 years leading CBSE residential and day schools, now advising 32 independent K12 schools across Rajasthan and MP on governance, accreditation, and digital readiness.",
    skills: [
      "Former Principal",
      "School Accreditation",
      "Multi-School Consulting",
      "Trustee Relations",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 32-school consortium",
      "Decision-maker relationship network",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    commentId: "cmt-015",
    postId: "post-k12-05",
    postUrl:
      "https://www.linkedin.com/posts/demo-school-founders_k12-b2b-partnerships-nep2020-activity-7262049182735005",
    authorName: "Gaurav Sengupta (Test)",
    authorProfileUrl:
      "https://www.linkedin.com/in/test-fixture-gaurav-sengupta-stem",
    headline:
      "Education Entrepreneur | Building K12 Robotics & Teacher Capacity Labs across 65 Schools",
    currentRole: "Co-Founder & CEO",
    organization: "BodhiTree School Labs",
    location: "Kolkata, West Bengal, India",
    commentText:
      "Working across 65 East India schools showed us that connecting with regional principal chapters accelerates multi-campus pilots.",
    commentedAt: "2026-11-04T18:10:00Z",
    experienceSummary:
      "Education entrepreneur partnering with 65 K12 schools in West Bengal, Odisha, and Assam; maintains strong relationships with school owners and principals.",
    skills: [
      "Education Entrepreneurship",
      "Multi-School Partnerships",
      "K12 B2B GTM",
      "Principal Relationships",
    ],
    schoolNetworkSignals: [
      "Education Entrepreneur",
      "Works with 65 K12 schools",
      "Regional Principal Chapter Partner",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
];

/**
 * Separate Candidate Directory Pool for Lookalike Discovery.
 * None of these profiles are labelled as commenters (strict separation enforced
 * by canonical URL deduplication against extracted commenters).
 */
export const TEST_CANDIDATE_POOL: CandidateProfileRecord[] = [
  {
    id: "cand-001",
    name: "Dr. Vandana Kulkarni (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-dr-vandana-kulkarni-k12",
    headline:
      "Former ICSE Principal (20 yrs) | Chief Academic Mentor to 30+ K12 Schools & Trusts",
    currentRole: "Chief School Transformation Advisor",
    organization: "Pragati K12 Advisory Collective",
    location: "Pune, Maharashtra, India",
    experienceSummary:
      "Served 20 years as Principal at leading ICSE & CBSE schools before founding an advisory practice supporting 30+ school trustees with academic audits, NEP 2020 implementation, and B2B EdTech procurement.",
    skills: [
      "Former Principal",
      "Trustee Advisory",
      "Multi-School Consulting",
      "EdTech Procurement",
      "NEP 2020",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 30+ K12 Schools",
      "Direct Trustee & Board Relationships",
    ],
    recentTopics: [
      "K12 School Governance",
      "Principal Mentoring",
      "Vendor Evaluation for School Trusts",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-002",
    name: "Sanjeevani Reddy (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-sanjeevani-reddy-trustee",
    headline:
      "Trustee & Director of Schools | Overseeing 16 K12 Campuses | School Network Strategist",
    currentRole: "Executive Trustee & School Director",
    organization: "Deccan Vidya Foundation",
    location: "Hyderabad, Telangana, India",
    experienceSummary:
      "Leads strategic expansion, academic governance, and digital transformation across 16 K12 schools in Telangana and Andhra Pradesh. Chairs regional private schools association committee.",
    skills: [
      "School Trustee",
      "Multi-Campus Director",
      "K12 Procurement",
      "School Associations",
    ],
    schoolNetworkSignals: [
      "School Trustee & Director",
      "16 K12 Campuses",
      "Regional School Association Leader",
    ],
    recentTopics: [
      "Multi-School Operations",
      "School Board Governance",
      "K12 EdTech ROI",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-003",
    name: "Prashant Bhardwaj (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-prashant-bhardwaj-edu",
    headline:
      "K12 Education Entrepreneur | Founder @ PrincipalCircle | Partnering with 140+ School Owners",
    currentRole: "Founder & Chief Ecosystem Officer",
    organization: "PrincipalCircle India",
    location: "Noida, Uttar Pradesh, India",
    experienceSummary:
      "Built an active peer community of 140+ K12 school founders, directors, and principals in NCR and Rajasthan; advises B2B education startups on school-network GTM and trustee introductions.",
    skills: [
      "Education Entrepreneurship",
      "K12 B2B GTM",
      "Principal Networks",
      "School Owner Relationships",
    ],
    schoolNetworkSignals: [
      "Education Entrepreneur",
      "140+ School Owners Network",
      "K12 Channel Advisory",
    ],
    recentTopics: [
      "K12 B2B Sales",
      "Principal Roundtables",
      "School Network Partnerships",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-004",
    name: "Dr. Alokita Banerjee (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-alokita-banerjee-k12",
    headline:
      "Independent School Accreditation Consultant | Former Principal | CBSE & Cambridge Advisor",
    currentRole: "Senior K12 Accreditation & Governance Consultant",
    organization: "Eastern Horizon EduAdvisory",
    location: "Kolkata, West Bengal, India",
    experienceSummary:
      "Former school principal with 17 years of K12 leadership; advises 22 independent schools across East India on affiliation, curriculum modernization, and strategic vendor partnerships.",
    skills: [
      "Former Principal",
      "School Accreditation",
      "Multi-School Advisory",
      "Curriculum Strategy",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Advises 22 Independent Schools",
      "Trust Board Advisor",
    ],
    recentTopics: [
      "School Accreditation",
      "K12 Leadership",
      "Academic Quality Audits",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-005",
    name: "Manishankar Kapoor (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-manishankar-kapoor-k12",
    headline:
      "K12 School Setup & Franchising Consultant | Advised 35+ School Promoters & Trustees",
    currentRole: "Managing Director - School Advisory",
    organization: "Kapoor K12 Ventures",
    location: "Chandigarh, India",
    experienceSummary:
      "15 years helping school promoters, trusts, and education entrepreneurs launch, accredit, and scale K12 schools across North India; deeply connected to school decision-makers.",
    skills: [
      "School Setup Consulting",
      "Trustee Advisory",
      "K12 Franchising",
      "B2B Ecosystem Strategy",
    ],
    schoolNetworkSignals: [
      "Education Consultant",
      "Advises 35+ School Promoters",
      "Deep Decision-Maker Network",
    ],
    recentTopics: [
      "New School Setup",
      "K12 B2B Partnerships",
      "Promoter Governance",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-006",
    name: "Rituja Deshpande (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-rituja-deshpande-edu",
    headline:
      "Director of School Networks & Institutional Alliances | Connecting 300+ K12 Schools",
    currentRole: "Director - K12 School Networks",
    organization: "ShikshaSetu Alliance",
    location: "Ahmedabad, Gujarat, India",
    experienceSummary:
      "Manages institutional relationships with 300+ K12 schools across Gujarat and Maharashtra, coordinating principal conclaves and vetted B2B EdTech pilot rollouts.",
    skills: [
      "School Network Alliances",
      "K12 B2B Partnerships",
      "Principal Conclaves",
      "Multi-School Rollouts",
    ],
    schoolNetworkSignals: [
      "Multi-School Network Director",
      "300+ K12 School Relationships",
    ],
    recentTopics: [
      "K12 B2B Sales",
      "School Consortium Pilots",
      "Principal Leadership",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-007",
    name: "Nitin Agarwal (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-nitin-agarwal-schools",
    headline:
      "School Owner & Chairman | 7 CBSE Campuses | Angel Investor in K12 Education",
    currentRole: "Chairman & Managing Director",
    organization: "Saraswati Heritage Schools",
    location: "Indore, Madhya Pradesh, India",
    experienceSummary:
      "Owns and operates 7 K12 schools in Central India, serves on state private school management forum, and actively pilots B2B school software and pedagogy partners.",
    skills: [
      "School Ownership",
      "Trustee Governance",
      "K12 Multi-Campus",
      "EdTech Piloting",
    ],
    schoolNetworkSignals: [
      "School Owner & Chairman",
      "7 K12 Campuses",
      "State School Forum Member",
    ],
    recentTopics: [
      "School Ownership Economics",
      "K12 Tech Adoption",
      "Tier-2 School Growth",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-008",
    name: "Shalini Krishnan (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-shalini-krishnan-k12",
    headline:
      "Retired Principal & National Teacher Training Consultant | Working with 28 Schools",
    currentRole: "Lead K12 Pedagogy & Leadership Consultant",
    organization: "Dakshin School Excellence Group",
    location: "Chennai, Tamil Nadu, India",
    experienceSummary:
      "Former Principal of a flagship CBSE school for 16 years; currently coaches leadership teams and advises school trusts on teacher capacity and digital classrooms across 28 schools.",
    skills: [
      "Former Principal",
      "Teacher Training",
      "School Advisory",
      "Multi-School Coaching",
    ],
    schoolNetworkSignals: [
      "Former Principal",
      "Works with 28 K12 Schools",
      "Leadership & Trust Coach",
    ],
    recentTopics: [
      "Principal Coaching",
      "NEP Classroom Adoption",
      "School Partnerships",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-009",
    name: "Devendra Singh Rathore (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-devendra-rathore-k12",
    headline:
      "Education Entrepreneur & K12 Distribution Partner | Serving 95 Schools in Rajasthan & MP",
    currentRole: "Founder & Managing Director",
    organization: "Aravalli EduPartners",
    location: "Udaipur, Rajasthan, India",
    experienceSummary:
      "Built a multi-product K12 school distribution network serving 95 private schools with labs, assessment tools, and ERP solutions; direct relationships with school owners and principals.",
    skills: [
      "K12 Distribution",
      "Education Entrepreneurship",
      "B2B School Sales",
      "Owner Relationships",
    ],
    schoolNetworkSignals: [
      "Education Entrepreneur",
      "Works with 95 K12 Schools",
      "K12 B2B Distribution Channel",
    ],
    recentTopics: [
      "Tier-2 K12 Sales",
      "School Channel Distribution",
      "Trust Relationships",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-010",
    name: "Anirudh Sengupta (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-anirudh-sengupta-edtech",
    headline:
      "Head of Strategic K12 Partnerships | Former School Operations Head (12 Campuses)",
    currentRole: "Head of Institutional Growth (K12)",
    organization: "NexusSchool Technologies",
    location: "Bengaluru, Karnataka, India",
    experienceSummary:
      "Previously ran multi-campus school operations for a 12-school chain; now leads B2B school partnerships and trustee outreach across South and West India.",
    skills: [
      "School Operations",
      "K12 B2B Partnerships",
      "Multi-Campus Management",
      "Enterprise Sales",
    ],
    schoolNetworkSignals: [
      "Former Multi-Campus Ops Head",
      "K12 Trustee Outreach",
    ],
    recentTopics: [
      "K12 B2B Sales",
      "Multi-School Chains",
      "School Ops Digitization",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-011",
    name: "Dr. Meherzia Patel (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-meherzia-patel-schools",
    headline:
      "Trustee & Academic Director | Western India Independent Schools Council",
    currentRole: "Academic Director & Board Trustee",
    organization: "Navjeevan Education Society",
    location: "Surat, Gujarat, India",
    experienceSummary:
      "Trustee and Academic Director across 6 K12 schools; coordinates annual school leadership symposiums attended by 80+ regional principals and school owners.",
    skills: [
      "Trustee Governance",
      "Academic Leadership",
      "School Symposiums",
      "K12 Networking",
    ],
    schoolNetworkSignals: [
      "Trustee & Academic Director",
      "6 K12 Schools + 80+ Principal Symposiums",
    ],
    recentTopics: [
      "School Trust Governance",
      "Principal Networks",
      "EdTech Vetting",
    ],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-012",
    name: "Karthikeya Varma (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-karthikeya-varma-saas",
    headline: "Regional Sales Manager - K12 EdTech | 4 Years in School B2B SaaS",
    currentRole: "Regional Sales Manager",
    organization: "ClassPulse Solutions",
    location: "Vijayawada, Andhra Pradesh, India",
    experienceSummary:
      "Manages direct K12 B2B SaaS sales across coastal Andhra Pradesh schools, closing annual contracts with private CBSE and state-board schools.",
    skills: ["K12 B2B Sales", "SaaS Closing", "School Demos"],
    schoolNetworkSignals: ["K12 B2B Sales Operator"],
    recentTopics: ["K12 B2B Sales", "School Demo Conversion"],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-013",
    name: "Tarunima Bose (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-tarunima-bose-highered",
    headline:
      "Assistant Professor of Economics | Higher Education Research & University Curriculum",
    currentRole: "Assistant Professor",
    organization: "Metro Liberal Arts University",
    location: "Delhi, India",
    experienceSummary:
      "Teaches undergraduate economics and coordinates university academic research grants; focuses exclusively on higher education.",
    skills: ["Higher Education", "Academic Research", "Econometrics"],
    schoolNetworkSignals: [],
    recentTopics: ["University Policy", "Undergraduate Economics"],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
  {
    id: "cand-014",
    name: "Raghavendra Pai (Test)",
    linkedinUrl:
      "https://www.linkedin.com/in/test-fixture-raghavendra-pai-prep",
    headline:
      "B2C Competitive Exam Physics Mentor | JEE/NEET Online Coaching",
    currentRole: "Lead Physics Faculty",
    organization: "Rankers Academy Online",
    location: "Kota, Rajasthan, India",
    experienceSummary:
      "B2C online instructor teaching physics to individual JEE/NEET aspirants on YouTube and mobile apps; no institutional K12 B2B school network.",
    skills: ["B2C Test Prep", "Physics Coaching", "Video Instruction"],
    schoolNetworkSignals: [],
    recentTopics: ["JEE Physics", "Student YouTube Growth"],
    dataSource: "labelled_test_dataset",
    isTestData: true,
  },
];
