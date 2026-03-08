// Legal Skills Bank - Skill Data
// Each skill contains full content for legal professionals

const TAG_CATEGORIES = {
  // Practice area tags (blue)
  'contract': 'practice',
  'due-diligence': 'practice',
  'clause': 'practice',
  'regulatory': 'practice',
  'dispute': 'practice',
  // Industry tags (gold)
  'SaaS': 'industry',
  'construction': 'industry',
  'technology': 'industry',
  'financial': 'industry',
  'real-estate': 'industry',
  'environmental': 'industry',
  // Jurisdiction tags (teal)
  'Australia': 'jurisdiction',
  'UK': 'jurisdiction',
  'US': 'jurisdiction',
  'EU': 'jurisdiction',
  'multi-jurisdiction': 'jurisdiction',
  // Topic tags (contract/coral)
  'liability': 'contract',
  'IP': 'contract',
  'privacy': 'contract',
  'employment': 'contract',
  'M&A': 'contract',
  'confidentiality': 'contract',
  'commercial': 'contract',
  'corporate': 'contract',
  'property': 'contract',
  'risk': 'contract',
  // Complexity tags (green)
  'beginner': 'complexity',
  'intermediate': 'complexity',
  'advanced': 'complexity',
  // Clause tags (pink)
  'indemnity': 'clause',
  'termination': 'clause',
  'force-majeure': 'clause',
  'limitation': 'clause',
  'arbitration': 'clause',
  'litigation': 'clause',
  'mediation': 'clause',
};

const FOLDER_META = {
  'contract-review': { icon: '📋', label: 'Contract Review', desc: 'Skills for reviewing and analyzing commercial contracts across industries.' },
  'due-diligence': { icon: '🔍', label: 'Due Diligence', desc: 'Structured due diligence checklists and red flag identification.' },
  'clause-library': { icon: '📐', label: 'Clause Library', desc: 'Deep-dive analysis of common contractual clauses and provisions.' },
  'regulatory-compliance': { icon: '⚖️', label: 'Regulatory Compliance', desc: 'Navigate regulatory frameworks and compliance requirements.' },
  'dispute-resolution': { icon: '🏛️', label: 'Dispute Resolution', desc: 'Litigation, arbitration, and mediation preparation skills.' },
  'jurisdictions': { icon: '🌐', label: 'Jurisdictions', desc: 'Jurisdiction-specific legal considerations and frameworks.' },
};

const SKILLS = [
  // ===== CONTRACT REVIEW =====
  {
    id: 'general-review',
    name: 'General Contract Review',
    path: 'contract-review/general-review',
    folder: 'contract-review',
    tags: ['contract', 'commercial', 'intermediate'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'intermediate',
    summary: 'Systematic approach to reviewing commercial contracts, identifying risks, and flagging key provisions.',
    content: `# General Contract Review

## Purpose
Provide a systematic, structured review of commercial contracts to identify risks, missing provisions, ambiguous language, and deviations from market standard terms.

## When to Use
- Reviewing any commercial agreement before execution
- Second-pass review of contracts drafted by counterparties
- Training junior lawyers on contract review methodology

## Review Framework

### 1. Parties & Recitals
- Verify correct legal entity names and ABN/ACN/registration numbers
- Check party descriptions match the operative clauses
- Confirm recitals accurately describe the transaction background
- Flag any undisclosed related-party relationships

### 2. Key Commercial Terms
- **Price / Fees**: Fixed, variable, or milestone-based? Escalation clauses?
- **Payment Terms**: Net 30? On delivery? Milestone-based?
- **Term**: Fixed term or rolling? Auto-renewal provisions?
- **Scope**: Is the scope of work/services clearly defined and bounded?

### 3. Risk Allocation
- Indemnification obligations (mutual or one-sided?)
- Limitation of liability (cap amount, carve-outs)
- Insurance requirements
- Warranty provisions and disclaimers

### 4. Termination
- Termination for convenience vs. cause
- Notice periods
- Consequences of termination (wind-down, data return, survival clauses)
- Change of control provisions

### 5. IP & Confidentiality
- IP ownership and assignment provisions
- License grants (scope, exclusivity, territory)
- Confidentiality obligations and carve-outs
- Return/destruction of confidential information

### 6. Boilerplate (Don't Skip These)
- Governing law and jurisdiction
- Dispute resolution mechanism
- Assignment and novation restrictions
- Force majeure
- Entire agreement clause
- Amendment provisions
- Severability
- Notices

## Red Flags
- Uncapped liability
- Unlimited indemnification obligations
- Unilateral amendment rights
- Automatic renewal without notice
- Broad IP assignment clauses
- Missing governing law
- "Best efforts" vs. "reasonable endeavours" mismatch
- Inconsistent defined terms

## Skill Prompt

> You are a senior commercial lawyer reviewing a contract. Analyse the document systematically using these categories: (1) Parties & Recitals, (2) Key Commercial Terms, (3) Risk Allocation, (4) Termination, (5) IP & Confidentiality, (6) Boilerplate. For each section, identify: issues found, risk level (high/medium/low), and recommended amendments. Present findings in a structured table format. Flag any red flags prominently at the top of your review.`
  },
  {
    id: 'saas-agreement-review',
    name: 'SaaS Agreement Review',
    path: 'contract-review/saas-agreement-review',
    folder: 'contract-review',
    tags: ['contract', 'SaaS', 'technology', 'commercial', 'intermediate'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'intermediate',
    summary: 'Review SaaS agreements focusing on SLAs, data handling, security, and subscription terms.',
    content: `# SaaS Agreement Review

## Purpose
Analyse Software-as-a-Service agreements with focus on service levels, data protection, security obligations, and the unique risks of cloud-based service delivery.

## When to Use
- Subscribing to any cloud/SaaS platform
- Reviewing vendor-provided SaaS terms
- Negotiating enterprise SaaS agreements

## Key Areas to Review

### 1. Service Description & Scope
- Is the service clearly defined? (Features, modules, user limits)
- Are there usage limits or fair use policies?
- What constitutes the "Service" vs. optional add-ons?
- API access and integration rights

### 2. Service Level Agreement (SLA)
- **Uptime commitment**: 99.9% vs 99.99% — know the difference (8.7hrs vs 52min downtime/year)
- **Measurement period**: Monthly? Quarterly?
- **Exclusions**: Scheduled maintenance, force majeure, customer-caused issues
- **Remedies**: Service credits vs. actual damages
- **Credit claim process**: Auto-applied or must request?

### 3. Data Rights & Security
- **Data ownership**: Customer retains ownership of customer data?
- **Data processing**: Where is data hosted? (Region/country)
- **Sub-processors**: List of sub-processors, notification of changes
- **Data portability**: Export formats, assistance with migration
- **Data deletion**: Timeline and certification after termination
- **Security standards**: SOC 2, ISO 27001, encryption standards
- **Breach notification**: Timeline (72 hours for GDPR), scope of notification

### 4. Subscription & Pricing
- Per-user, per-seat, consumption-based, or flat fee?
- Annual price increase caps
- True-up provisions for overuse
- Co-terming of additional subscriptions

### 5. Termination & Lock-in
- Minimum commitment period
- Data extraction period post-termination
- Transition assistance obligations
- Effect on integrations and connected services

## Red Flags
- Provider claims ownership of customer data
- No SLA or SLA with no financial remedies
- Data hosted in jurisdictions with weak privacy laws
- No data portability provisions
- Unilateral right to change service features
- Auto-renewal with price increase and no cap
- Broad rights to use customer data for "service improvement"

## Skill Prompt

> You are a technology lawyer reviewing a SaaS agreement. Focus on these critical areas: (1) Service scope and SLA terms, (2) Data ownership, security, and privacy compliance, (3) Pricing structure and escalation, (4) Termination and data portability, (5) Liability and indemnification. For each area, provide: current position, risk assessment, market standard comparison, and recommended markup. Pay special attention to data residency, sub-processor controls, and breach notification timelines.`
  },
  {
    id: 'construction-contract',
    name: 'Construction Contract Review',
    path: 'contract-review/construction-contract',
    folder: 'contract-review',
    tags: ['contract', 'construction', 'advanced'],
    jurisdiction: 'Australia',
    complexity: 'advanced',
    summary: 'Review construction contracts against AS/NZS standards, security of payment legislation, and industry practice.',
    content: `# Construction Contract Review

## Purpose
Review construction contracts with focus on Australian standards (AS 4000, AS 2124, AS 4902), security of payment legislation, and construction-specific risk allocation.

## When to Use
- Head contracts between principal and head contractor
- Subcontract reviews
- Design and construct (D&C) agreements
- EPC/turnkey contracts

## Key Areas to Review

### 1. Contract Structure
- Which standard form? (AS 4000, AS 2124, AS 4902, ABIC, bespoke)
- Amendments to standard form — are they fair and balanced?
- Order of precedence of contract documents
- Relationship between head contract and subcontracts (back-to-back?)

### 2. Scope & Variations
- Is the scope clearly defined in the specification?
- Variation mechanism — who can direct variations?
- Variation pricing methodology (schedule of rates, cost-plus, lump sum)
- Deemed variation provisions
- Latent conditions clause

### 3. Time
- Date for practical completion
- Extensions of time (EOT) regime — qualifying causes of delay
- Notice requirements for EOT claims (strict time bars?)
- Liquidated damages rate and cap
- Delay costs / prolongation claims

### 4. Payment
- Progress claim cycle (monthly?)
- Payment terms and timeframes
- **Security of Payment Act compliance** (Building and Construction Industry Security of Payment Act)
- Retention amounts and release triggers
- Bank guarantees / bonds — unconditional or conditional?
- Right to suspend for non-payment

### 5. Defects & Warranties
- Defect liability period (DLP) — typically 12 months
- Defect rectification process and timeframes
- Structural warranties (often 6-7 years)
- Warranty exclusions

### 6. Insurance & Indemnities
- Contract works insurance (who procures?)
- Public liability minimums
- Professional indemnity (for D&C)
- Workers compensation
- Cross-liability and principal's indemnity

## Red Flags
- Time-bar clauses that are unreasonably short
- Uncapped liquidated damages
- "Pay when paid" or "pay if paid" clauses (void under SOP legislation in most states)
- Principal's right to direct variations without price agreement
- Blanket fitness for purpose obligations in D&C contracts
- No latent conditions clause
- Unlimited defect liability period

## Jurisdiction Notes
Security of Payment legislation varies by state:
- **NSW**: Building and Construction Industry Security of Payment Act 1999
- **VIC**: Building and Construction Industry Security of Payment Act 2002
- **QLD**: Building Industry Fairness (Security of Payment) Act 2017
- **WA**: Building and Construction Industry (Security of Payment) Act 2021

## Skill Prompt

> You are a construction lawyer reviewing a building contract under Australian law. Analyse the contract against these areas: (1) Contract form and amendments to standard, (2) Scope and variation mechanism, (3) Time provisions including EOT and liquidated damages, (4) Payment including SOP Act compliance, (5) Defects and warranties, (6) Insurance and indemnities. Identify departures from the relevant standard form (AS 4000/AS 2124/AS 4902). Flag any provisions that may be void or unenforceable under applicable Security of Payment legislation. Present as a risk register with severity ratings.`
  },
  {
    id: 'employment-contract',
    name: 'Employment Contract Review',
    path: 'contract-review/employment-contract',
    folder: 'contract-review',
    tags: ['contract', 'employment', 'intermediate'],
    jurisdiction: 'Australia',
    complexity: 'intermediate',
    summary: 'Review employment agreements for Fair Work compliance, restraint validity, and IP assignment.',
    content: `# Employment Contract Review

## Purpose
Review employment contracts ensuring compliance with the Fair Work Act 2009, National Employment Standards (NES), and applicable Modern Awards, while protecting employer interests in IP and confidential information.

## When to Use
- Drafting or reviewing new employment agreements
- Reviewing executive service agreements
- Assessing enforceability of restraint of trade clauses
- Employee transitions and role changes

## Key Areas to Review

### 1. Employment Terms
- Full-time, part-time, or casual classification
- Fixed term or ongoing
- Probation period (typically 3-6 months)
- Position description and reporting lines
- Location and remote work provisions

### 2. Remuneration & Benefits
- Base salary / hourly rate
- Superannuation (currently 11.5% — confirm current rate)
- Bonus / incentive structure (discretionary vs. contractual)
- Salary sacrifice arrangements
- Motor vehicle / parking allowances
- NES compliance (minimum entitlements cannot be contracted out)

### 3. Leave Entitlements
- Annual leave (NES minimum: 4 weeks)
- Personal/carer's leave (NES minimum: 10 days)
- Long service leave (state-based)
- Parental leave
- Additional leave (study, volunteer, etc.)

### 4. Restraint of Trade
- Non-compete: scope, duration, geography — cascading provisions?
- Non-solicitation: clients, employees, suppliers
- Non-dealing provisions
- Garden leave clauses
- **Enforceability test**: Is the restraint reasonable to protect a legitimate business interest? (Consider: seniority, access to confidential info, client relationships)

### 5. IP & Confidential Information
- IP assignment clause — present and future IP?
- Moral rights consent
- Definition of confidential information
- Post-employment obligations
- Return of materials on termination

### 6. Termination
- Notice periods (check NES minimums based on tenure)
- Termination for cause — what constitutes "serious misconduct"?
- Redundancy provisions (NES entitlements)
- Post-termination obligations

## Red Flags
- Remuneration below Modern Award rates
- Restraint clauses without cascading provisions
- Overly broad IP assignment (capturing personal projects)
- No clear distinction between employee-created and employer-owned IP
- Missing or inadequate superannuation provisions
- Attempting to contract out of NES entitlements
- Unreasonable probation termination provisions

## Skill Prompt

> You are an employment lawyer reviewing an employment contract under Australian law. Assess the agreement against: (1) Fair Work Act and NES compliance, (2) Modern Award coverage and entitlements, (3) Remuneration and benefits, (4) Restraint of trade enforceability, (5) IP ownership and confidentiality, (6) Termination provisions. Flag any terms that contravene the NES or applicable Modern Award. Assess restraint clauses for reasonableness. Present findings as a compliance checklist with risk ratings.`
  },
  {
    id: 'nda-review',
    name: 'NDA Review',
    path: 'contract-review/nda-review',
    folder: 'contract-review',
    tags: ['contract', 'IP', 'confidentiality', 'beginner'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'beginner',
    summary: 'Review non-disclosure agreements for scope, carve-outs, term, and practical enforceability.',
    content: `# NDA Review

## Purpose
Efficiently review non-disclosure / confidentiality agreements to ensure appropriate protection without unnecessarily restricting business operations.

## When to Use
- Before sharing confidential information with potential partners, investors, or vendors
- Reviewing counterparty-provided NDAs
- M&A preliminary discussions
- Joint venture or collaboration exploratory phase

## Key Areas to Review

### 1. Structure
- **Mutual vs. Unilateral**: Does information flow both ways?
- **Standalone vs. Embedded**: Part of a larger agreement?

### 2. Definition of Confidential Information
- Is it clearly defined?
- Marked/designated information only, or all information disclosed?
- Does it cover oral disclosures? (Usually requires written confirmation within X days)
- Residual knowledge / skills carve-out?

### 3. Standard Carve-Outs (Must Have)
The following should NOT be considered confidential:
- Information already in the public domain (not through breach)
- Information already known to the recipient
- Information independently developed by the recipient
- Information received from a third party without restriction
- Information required to be disclosed by law or regulation

### 4. Permitted Use & Disclosure
- Purpose limitation — is the "Purpose" narrowly defined?
- Permitted disclosees (employees, advisors, affiliates)
- "Need to know" basis requirement
- Obligation to ensure disclosees comply

### 5. Term & Survival
- Agreement term (typically 1-3 years for disclosure period)
- Survival of obligations after termination (2-5 years typical, sometimes indefinite for trade secrets)
- Return or destruction obligations

### 6. Remedies
- Injunctive relief acknowledgment
- Indemnification for breach
- Consequential damages — included or excluded?

## Red Flags
- No carve-outs for publicly available information
- Overly broad definition capturing all business information
- No time limit on obligations (except for trade secrets)
- Restrictions on hiring employees (disguised non-solicit)
- One-sided obligations in a mutual information exchange
- No return/destruction mechanism
- Non-compete provisions hidden in an NDA
- Excessive remedies (e.g., liquidated damages for breach)

## Skill Prompt

> You are a commercial lawyer reviewing an NDA. Assess: (1) Is it mutual or unilateral, and is that appropriate? (2) Is "Confidential Information" clearly and reasonably defined? (3) Are standard carve-outs present? (4) Is the permitted purpose appropriately scoped? (5) Are term and survival periods reasonable? (6) Are remedies proportionate? Flag any unusual or overreaching provisions. Recommend specific amendments where needed. Keep the review concise and practical.`
  },

  // ===== DUE DILIGENCE =====
  {
    id: 'corporate-dd',
    name: 'Corporate Due Diligence',
    path: 'due-diligence/corporate-dd',
    folder: 'due-diligence',
    tags: ['due-diligence', 'corporate', 'M&A', 'advanced'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'advanced',
    summary: 'M&A due diligence checklist covering corporate structure, material contracts, litigation, and compliance.',
    content: `# Corporate Due Diligence

## Purpose
Conduct comprehensive legal due diligence for mergers, acquisitions, and investments. Identify legal risks that affect valuation, deal structure, and post-completion integration.

## When to Use
- Share or asset purchase transactions
- Private equity investments
- Joint ventures
- Significant minority investments

## DD Checklist

### 1. Corporate Structure & Governance
- [ ] Certificate of incorporation / registration
- [ ] Constitution / articles of association (current)
- [ ] Share register and cap table
- [ ] Director and officer registers
- [ ] Board and shareholder minutes (last 3 years)
- [ ] Shareholder agreements / investor agreements
- [ ] Powers of attorney
- [ ] Subsidiary and related entity structure chart
- [ ] Trust deeds (if trusts in structure)

### 2. Material Contracts
- [ ] Top 10 customer contracts by revenue
- [ ] Top 10 supplier contracts by spend
- [ ] Contracts with change of control provisions
- [ ] Contracts with non-assignment clauses
- [ ] Related party transactions
- [ ] Joint venture agreements
- [ ] Distribution / agency agreements
- [ ] Franchise agreements

### 3. Employment & HR
- [ ] Executive service agreements
- [ ] Standard employment contract templates
- [ ] Enterprise agreements / collective bargaining agreements
- [ ] Contractor agreements (independent contractor risk)
- [ ] Employee share/option plans
- [ ] Outstanding employment claims or disputes
- [ ] Redundancy provisions and liabilities
- [ ] Key person dependencies

### 4. IP & Technology
- [ ] Registered IP portfolio (patents, trademarks, designs)
- [ ] IP assignment agreements from founders/employees
- [ ] Software licenses (inbound and outbound)
- [ ] Open source software usage and compliance
- [ ] Technology development agreements
- [ ] Data processing agreements
- [ ] Domain name registrations

### 5. Litigation & Disputes
- [ ] Current proceedings (plaintiff and defendant)
- [ ] Threatened claims or disputes
- [ ] Regulatory investigations or inquiries
- [ ] Historical litigation (last 5 years)
- [ ] Insurance claims history
- [ ] Compliance breach history

### 6. Real Property
- [ ] Owned property titles and encumbrances
- [ ] Lease agreements and terms
- [ ] Licenses to occupy
- [ ] Environmental assessments

### 7. Regulatory & Compliance
- [ ] Licenses and permits (current and required)
- [ ] Regulatory correspondence
- [ ] Privacy/data protection compliance
- [ ] Anti-bribery and corruption policies
- [ ] Competition/antitrust compliance
- [ ] Industry-specific regulations

## Red Flags
- Undisclosed litigation or regulatory investigations
- Key contracts with change of control termination rights
- IP not properly assigned to the company
- Reliance on a single customer (>30% revenue)
- Outstanding tax disputes or assessments
- Non-arm's length related party transactions
- Environmental contamination liabilities
- Unfunded employee entitlements

## Skill Prompt

> You are a senior M&A lawyer conducting legal due diligence. Using the provided documents, systematically review and report on: (1) Corporate structure and governance, (2) Material contracts and change of control risks, (3) Employment liabilities, (4) IP ownership and technology risks, (5) Litigation exposure, (6) Regulatory compliance status. For each category, provide: key findings, risk rating (red/amber/green), estimated liability exposure where quantifiable, and recommended warranty/indemnity protections for the SPA. Present as a DD report with executive summary.`
  },
  {
    id: 'property-dd',
    name: 'Property Due Diligence',
    path: 'due-diligence/property-dd',
    folder: 'due-diligence',
    tags: ['due-diligence', 'property', 'real-estate', 'intermediate'],
    jurisdiction: 'Australia',
    complexity: 'intermediate',
    summary: 'Property acquisition due diligence covering title, encumbrances, zoning, and environmental matters.',
    content: `# Property Due Diligence

## Purpose
Conduct thorough legal due diligence for commercial or residential property acquisitions, identifying title defects, planning restrictions, and environmental risks.

## When to Use
- Commercial property acquisitions
- Residential development site purchases
- Lease due diligence for major premises
- Property portfolio transactions

## DD Checklist

### 1. Title Searches
- [ ] Certificate of Title (current)
- [ ] Registered proprietor verification
- [ ] Encumbrances (mortgages, caveats, easements, covenants)
- [ ] Historical title searches (chain of ownership)
- [ ] Unregistered interests
- [ ] Native title searches (if applicable)
- [ ] Crown land status

### 2. Planning & Zoning
- [ ] Current zoning classification
- [ ] Permitted uses under zoning
- [ ] Development applications (approved and pending)
- [ ] Building approvals and certificates of occupancy
- [ ] Heritage listing or overlay
- [ ] Flood zone mapping
- [ ] Bushfire prone land status
- [ ] Infrastructure contributions / developer levies

### 3. Environmental
- [ ] Contaminated land register search
- [ ] Phase 1 Environmental Site Assessment
- [ ] Asbestos register (for existing buildings)
- [ ] Underground storage tanks
- [ ] EPA notices or orders
- [ ] Remediation obligations

### 4. Leases & Occupancy
- [ ] Current lease register
- [ ] Lease terms and expiry dates
- [ ] Tenant financial standing
- [ ] Vacancy rates
- [ ] Rent review mechanisms
- [ ] Make-good obligations
- [ ] Options to renew

### 5. Services & Infrastructure
- [ ] Water, gas, electricity, telecommunications connections
- [ ] Stormwater and drainage
- [ ] Road access and easements
- [ ] Body corporate / strata records (if applicable)

## Red Flags
- Unregistered easements affecting development potential
- Contamination requiring remediation
- Heritage overlay restricting modifications
- Adverse possession claims
- Zoning non-compliance of existing use
- Significant deferred maintenance
- Below-market leases with long remaining terms

## Skill Prompt

> You are a property lawyer conducting due diligence on a property acquisition in Australia. Review the provided documents and report on: (1) Title status and encumbrances, (2) Planning and zoning compliance, (3) Environmental risks, (4) Lease analysis (if tenanted), (5) Infrastructure and services. Rate each area as green (clear), amber (manageable risk), or red (material concern). Provide specific recommendations for conditions precedent in the contract of sale.`
  },
  {
    id: 'ip-dd',
    name: 'IP Due Diligence',
    path: 'due-diligence/ip-dd',
    folder: 'due-diligence',
    tags: ['due-diligence', 'IP', 'technology', 'advanced'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'advanced',
    summary: 'Intellectual property due diligence for acquisitions and investments, covering patents, trademarks, and trade secrets.',
    content: `# IP Due Diligence

## Purpose
Assess the strength, ownership, and risks associated with a target company's intellectual property portfolio. Critical for technology acquisitions and IP-heavy businesses.

## When to Use
- Acquiring technology companies
- Licensing negotiations
- Investment in IP-heavy startups
- Freedom-to-operate assessments

## DD Checklist

### 1. Registered IP
- [ ] Patent portfolio (granted and pending) — jurisdiction, expiry, maintenance fees current
- [ ] Trademark registrations — classes, jurisdictions, renewal dates
- [ ] Registered designs
- [ ] Domain name portfolio
- [ ] Plant breeder's rights (if applicable)

### 2. Ownership & Chain of Title
- [ ] IP assignment agreements from founders
- [ ] Employee IP assignment clauses in employment contracts
- [ ] Contractor IP assignment agreements
- [ ] University or research institution IP agreements
- [ ] Government grant IP conditions
- [ ] Joint ownership arrangements

### 3. Licenses
- [ ] Inbound licenses (IP licensed FROM third parties)
- [ ] Outbound licenses (IP licensed TO third parties)
- [ ] Exclusive vs non-exclusive
- [ ] Territory and field of use restrictions
- [ ] Royalty obligations
- [ ] Change of control provisions in licenses
- [ ] Open source software licenses and compliance

### 4. IP Disputes & Risks
- [ ] Current or threatened infringement claims
- [ ] Opposition proceedings
- [ ] Freedom-to-operate analysis
- [ ] Prior art risks for patents
- [ ] Trademark conflicts
- [ ] Trade secret protection measures

### 5. Trade Secrets & Know-How
- [ ] Identification of key trade secrets
- [ ] Protection measures (NDAs, access controls, policies)
- [ ] Employee awareness and training
- [ ] Departing employee protocols

## Red Flags
- Core IP not assigned to the company (still with founders)
- Missing contractor IP assignments
- Patent applications likely to be refused based on prior art
- Open source license contamination (copyleft licenses in proprietary software)
- Key licenses with change of control termination rights
- Trade secrets without adequate protection measures
- Expiring patents with no pipeline
- Trademark registrations not covering key markets

## Skill Prompt

> You are an IP lawyer conducting due diligence on a target company's IP portfolio. Analyse: (1) Registered IP portfolio strength and coverage, (2) Chain of title and ownership gaps, (3) License dependencies and change of control risks, (4) Litigation and dispute exposure, (5) Trade secret protection adequacy. Provide a portfolio valuation risk assessment. Flag any IP that may not successfully transfer on completion. Recommend specific warranties and indemnities for the acquisition agreement.`
  },

  // ===== CLAUSE LIBRARY =====
  {
    id: 'indemnity-clauses',
    name: 'Indemnity Clause Analysis',
    path: 'clause-library/indemnity-clauses',
    folder: 'clause-library',
    tags: ['clause', 'liability', 'indemnity', 'intermediate'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'intermediate',
    summary: 'Analyse and draft indemnity clauses — types, scope, caps, baskets, and common pitfalls.',
    content: `# Indemnity Clause Analysis

## Purpose
Understand, analyse, and draft indemnity provisions. Indemnities are among the most heavily negotiated clauses in commercial contracts and often the source of the greatest financial exposure.

## Key Concepts

### Types of Indemnity
1. **Bare/Naked Indemnity**: Indemnifier covers losses regardless of fault — extremely one-sided
2. **Proportionate Indemnity**: Indemnifier covers losses to the extent caused by their actions
3. **Third-Party Claim Indemnity**: Covers losses arising from claims by third parties
4. **Reverse Indemnity**: Party indemnifies for the other party's negligence — often unenforceable

### Scope Variables
- **Losses covered**: Direct, indirect, consequential, loss of profits
- **Claims covered**: Third party only, or also direct claims between parties
- **Trigger events**: Breach of contract, breach of warranty, negligence, wilful misconduct
- **Scope of obligation**: "Hold harmless", "indemnify", "defend" — each has different implications

### Financial Controls
- **Cap**: Maximum aggregate liability under the indemnity
- **Basket/Threshold**: Minimum loss before indemnity applies (deductible vs. tipping basket)
- **Time limit**: Period after closing during which claims can be made
- **De minimis**: Minimum individual claim size

## Analysis Framework

When reviewing an indemnity clause, assess:

1. **Who indemnifies whom?** (mutual or one-sided)
2. **What triggers the indemnity?** (breach, negligence, third-party claim)
3. **What losses are covered?** (direct only, or including consequential)
4. **What are the financial limits?** (cap, basket, de minimis, time limit)
5. **What is the claims process?** (notice, conduct of defence, mitigation)
6. **Are there carve-outs?** (fraud, wilful misconduct usually uncapped)
7. **How does it interact with limitation of liability?** (indemnity often carves out from general cap)

## Common Pitfalls
- Indemnity that effectively circumvents the limitation of liability clause
- No obligation to mitigate losses
- No notification requirements (late notice = prejudice to indemnifier)
- Inconsistent treatment between indemnity clause and general limitation clause
- "Indemnify and hold harmless" — in some jurisdictions these are distinct obligations

## Skill Prompt

> You are a commercial lawyer analysing an indemnity clause. For the provided clause, determine: (1) Type of indemnity (bare, proportionate, third-party), (2) Trigger events, (3) Scope of losses covered, (4) Financial controls (cap, basket, time limits), (5) Claims process requirements, (6) Interaction with the limitation of liability clause. Assess whether the clause is balanced or favours one party. Provide a redline with specific amendments to achieve a more balanced position, with explanatory commentary for each change.`
  },
  {
    id: 'limitation-of-liability',
    name: 'Limitation of Liability',
    path: 'clause-library/limitation-of-liability',
    folder: 'clause-library',
    tags: ['clause', 'liability', 'limitation', 'risk', 'intermediate'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'intermediate',
    summary: 'Review and draft limitation of liability clauses — caps, exclusions, and carve-outs.',
    content: `# Limitation of Liability

## Purpose
Analyse and draft limitation of liability clauses that appropriately allocate financial risk between contracting parties.

## Key Components

### 1. Liability Cap
- **Fixed amount**: e.g., "$1,000,000"
- **Contract value multiple**: e.g., "2x the fees paid in the preceding 12 months"
- **Insurance-linked**: e.g., "the amount recoverable under the relevant insurance policy"
- **Per-incident vs. aggregate**: Does the cap apply per claim or in total?

### 2. Exclusion of Consequential Loss
- Typically excludes: loss of profits, loss of revenue, loss of data, loss of goodwill, loss of anticipated savings
- **Critical question**: Is "consequential loss" defined? (If not, common law definitions apply and vary by jurisdiction)
- In Australia, consider *Environmental Systems Pty Ltd v Peerless Holdings* — broad interpretation of "consequential loss"
- Some contracts define consequential loss to include indirect losses that would otherwise be direct

### 3. Carve-Outs (Uncapped Items)
Common carve-outs from the liability cap:
- Fraud or wilful misconduct
- Death or personal injury caused by negligence
- Breach of confidentiality obligations
- IP infringement indemnity
- Data breach / privacy obligations
- Payment obligations (fees owed)

### 4. Mutual vs. Asymmetric
- Are the limitations mutual?
- If asymmetric, is the imbalance justified by the commercial context?
- Consider: who has more control over the risk?

## Analysis Checklist
- [ ] Is there a liability cap? Is the amount appropriate relative to contract value?
- [ ] Is consequential loss excluded? Is it defined?
- [ ] What are the carve-outs? Are they appropriate?
- [ ] Does the limitation apply to indemnity obligations?
- [ ] Is the limitation mutual or one-sided?
- [ ] Does it comply with applicable legislation? (e.g., Australian Consumer Law — cannot limit certain statutory guarantees)
- [ ] How does it interact with insurance requirements?

## Skill Prompt

> You are a commercial lawyer reviewing a limitation of liability clause. Analyse: (1) The liability cap — amount, calculation method, per-incident vs aggregate, (2) Consequential loss exclusion — scope and definition, (3) Carve-outs from the cap, (4) Mutuality of limitations, (5) Compliance with applicable consumer protection legislation, (6) Interaction with indemnity and insurance provisions. Recommend a balanced position with specific drafting suggestions.`
  },
  {
    id: 'force-majeure',
    name: 'Force Majeure Clause Review',
    path: 'clause-library/force-majeure',
    folder: 'clause-library',
    tags: ['clause', 'force-majeure', 'risk', 'commercial', 'beginner'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'beginner',
    summary: 'Analyse force majeure clauses for trigger events, notice requirements, and consequences.',
    content: `# Force Majeure Clause Review

## Purpose
Review force majeure clauses to ensure appropriate protection against unforeseeable events that prevent contractual performance. Post-COVID, these clauses receive significantly more scrutiny.

## Key Concepts

### What is Force Majeure?
- Not a common law doctrine (unlike frustration)
- Purely a contractual mechanism — must be expressly included
- French origin: "superior force"
- If not in the contract, parties must rely on the doctrine of frustration (much harder to establish)

### Essential Elements
1. **Trigger events**: What constitutes a force majeure event?
2. **Causation**: Must the event *prevent* performance, or merely make it *more difficult/expensive*?
3. **Notice**: What notification is required?
4. **Consequences**: Suspension, termination, or both?
5. **Mitigation**: Obligation to mitigate or find alternatives?

## Analysis Framework

### 1. Trigger Events
**Typically included:**
- Natural disasters (earthquake, flood, hurricane, bushfire)
- War, terrorism, civil unrest
- Government action (embargo, sanctions, regulation change)
- Pandemic / epidemic
- Labour disputes (strikes, lockouts)
- Infrastructure failure (power grid, telecommunications)

**Watch for:**
- Is the list exhaustive or does it include a catch-all? ("...and any other event beyond reasonable control")
- Are economic events included? (Currency collapse, market disruption)
- Is climate change / extreme weather specifically addressed?
- Supply chain disruption — included or excluded?

### 2. Threshold
- "Prevented" (highest — performance must be impossible)
- "Hindered" (middle — performance materially more difficult)
- "Delayed" (lowest — any delay qualifies)
- Prefer "prevented or materially hindered" for balanced position

### 3. Notice Requirements
- Timeframe for notification (typically 5-14 days)
- Form of notice (written, to specified address)
- Content requirements (description of event, expected duration, mitigation steps)
- Consequences of late notice

### 4. Consequences
- Suspension of obligations during the event
- Extension of time for performance
- Right to terminate if event continues beyond specified period (e.g., 90-180 days)
- Allocation of costs during suspension
- No liability for non-performance during the event

## Post-COVID Considerations
- Pandemic is now a *foreseeable* event — may not qualify under some clauses
- Consider specific pandemic/epidemic carve-outs
- Government lockdown orders vs. voluntary closures
- Supply chain disruption as a cascading force majeure event

## Skill Prompt

> You are a commercial lawyer reviewing a force majeure clause. Analyse: (1) Scope of trigger events — are they comprehensive and current (including pandemic, cyber attack, climate events)? (2) Performance threshold — prevented, hindered, or delayed? (3) Notice requirements, (4) Consequences and termination rights, (5) Mitigation obligations, (6) Post-COVID adequacy. Recommend specific amendments to modernise and balance the clause.`
  },
  {
    id: 'termination-clauses',
    name: 'Termination Clause Analysis',
    path: 'clause-library/termination-clauses',
    folder: 'clause-library',
    tags: ['clause', 'termination', 'commercial', 'beginner'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'beginner',
    summary: 'Review termination provisions including for convenience, cause, insolvency, and consequences.',
    content: `# Termination Clause Analysis

## Purpose
Analyse termination provisions to ensure clear exit rights, appropriate cure periods, and well-defined post-termination obligations.

## Types of Termination

### 1. Termination for Convenience
- Either party can terminate without cause
- Typically requires notice period (30-90 days)
- May include early termination fee / break fee
- **Key question**: Is this mutual, or only available to one party?

### 2. Termination for Cause (Breach)
- Triggered by material breach of the contract
- Usually requires notice and opportunity to cure
- **Cure period**: 14-30 days is typical
- Define what constitutes a "material" breach (or list specific breaches)
- Repeated non-material breaches — aggregate trigger?

### 3. Termination for Insolvency
- Triggered by insolvency events (administration, liquidation, receivership)
- ipso facto reform (Australia): Corporations Act 2001 s 451E restricts enforcement of ipso facto clauses during administration/restructuring
- Consider carve-outs from ipso facto restrictions

### 4. Termination for Change of Control
- Triggered by change in ownership or control
- Define "change of control" clearly (>50% voting rights? Board control?)
- May include competitor acquisition trigger

### 5. Termination by Effluxion of Time
- Fixed-term contracts that expire automatically
- Renewal / extension mechanisms
- Holdover provisions

## Key Analysis Points

### Notice Requirements
- Written notice to specified address
- Adequate notice period
- Content requirements (specify the breach and required cure)

### Consequences of Termination
- [ ] Accrued rights survive termination
- [ ] Payment for work done to date
- [ ] Return of property, materials, and data
- [ ] Confidentiality obligations survive
- [ ] Transition / handover period
- [ ] Wind-down obligations
- [ ] Survival clause — which clauses survive termination?

### Financial Consequences
- Termination fees / break fees
- Refund of prepaid amounts
- Outstanding invoices — accelerated payment?
- Damages for wrongful termination

## Red Flags
- No cure period for breach
- Only one party has termination for convenience rights
- No survival clause
- Unclear consequences of termination
- Termination fee that amounts to a penalty (may be unenforceable)
- No transition or handover obligations
- Vague definition of material breach

## Skill Prompt

> You are a commercial lawyer reviewing termination provisions. Analyse: (1) Termination rights available to each party (convenience, cause, insolvency, change of control), (2) Notice and cure periods, (3) Definition of material breach, (4) Consequences of termination (payment, data return, transition), (5) Survival provisions, (6) Any termination fees and their enforceability. Assess balance between parties and recommend amendments for a fairer position.`
  },

  // ===== REGULATORY COMPLIANCE =====
  {
    id: 'privacy-gdpr',
    name: 'GDPR / Privacy Compliance',
    path: 'regulatory-compliance/privacy-gdpr',
    folder: 'regulatory-compliance',
    tags: ['regulatory', 'privacy', 'EU', 'technology', 'intermediate'],
    jurisdiction: 'EU',
    complexity: 'intermediate',
    summary: 'GDPR and privacy law compliance review covering data processing, consent, DPAs, and cross-border transfers.',
    content: `# GDPR / Privacy Compliance

## Purpose
Assess compliance with the General Data Protection Regulation (EU) 2016/679 and related privacy legislation. Applicable to any organisation processing personal data of EU/EEA individuals.

## When to Use
- Assessing GDPR compliance posture
- Reviewing data processing agreements (DPAs)
- Cross-border data transfer assessments
- Privacy impact assessments (DPIAs)
- Vendor due diligence for data processors

## Compliance Framework

### 1. Lawful Basis for Processing (Article 6)
- [ ] Consent (freely given, specific, informed, unambiguous)
- [ ] Contract performance
- [ ] Legal obligation
- [ ] Vital interests
- [ ] Public interest
- [ ] Legitimate interests (requires balancing test)
- **For each processing activity, document the lawful basis**

### 2. Data Subject Rights
Organisations must facilitate:
- [ ] Right of access (Article 15) — respond within 1 month
- [ ] Right to rectification (Article 16)
- [ ] Right to erasure / "right to be forgotten" (Article 17)
- [ ] Right to restrict processing (Article 18)
- [ ] Right to data portability (Article 20)
- [ ] Right to object (Article 21)
- [ ] Rights related to automated decision-making (Article 22)

### 3. Data Processing Agreements
When engaging processors (vendors), the DPA must include:
- Subject matter and duration of processing
- Nature and purpose of processing
- Types of personal data and categories of data subjects
- Obligations and rights of the controller
- Processor obligations (Article 28):
  - Process only on documented instructions
  - Ensure personnel confidentiality
  - Implement appropriate security measures
  - Sub-processor controls and notification
  - Assist with data subject requests
  - Delete or return data on termination
  - Allow and contribute to audits

### 4. Cross-Border Data Transfers
Post-Schrems II, transfers outside EEA require:
- [ ] Adequacy decision (e.g., EU-US Data Privacy Framework)
- [ ] Standard Contractual Clauses (SCCs) — new 2021 version
- [ ] Transfer Impact Assessment (TIA)
- [ ] Supplementary measures if needed
- [ ] Binding Corporate Rules (for intra-group transfers)

### 5. Security & Breach Notification
- Appropriate technical and organisational measures (Article 32)
- Breach notification to supervisory authority within **72 hours** (Article 33)
- Notification to data subjects if high risk (Article 34)
- Document all breaches regardless of notification requirement

## Key Documents to Review
- Privacy policy / notice
- Cookie policy and consent mechanism
- Records of processing activities (ROPA)
- Data processing agreements with vendors
- Data protection impact assessments
- Data breach response plan
- Data retention schedule
- International transfer mechanisms

## Skill Prompt

> You are a privacy lawyer assessing GDPR compliance. Review the provided materials and assess: (1) Lawful basis documentation for each processing activity, (2) Data subject rights procedures and response times, (3) Data processing agreements with vendors, (4) Cross-border transfer mechanisms (SCCs, adequacy decisions, TIAs), (5) Security measures and breach notification procedures, (6) Records of processing activities. Provide a compliance gap analysis with risk ratings and remediation priorities.`
  },

  // ===== DISPUTE RESOLUTION =====
  {
    id: 'litigation-prep',
    name: 'Litigation Preparation',
    path: 'dispute-resolution/litigation-prep',
    folder: 'dispute-resolution',
    tags: ['dispute', 'litigation', 'advanced'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'advanced',
    summary: 'Structured approach to litigation preparation including document review, chronology, and evidence assessment.',
    content: `# Litigation Preparation

## Purpose
Provide a systematic framework for preparing commercial litigation matters, from initial assessment through to trial preparation.

## When to Use
- New dispute referred for litigation assessment
- Pre-action protocol compliance
- Document review and discovery preparation
- Trial preparation

## Preparation Framework

### 1. Initial Case Assessment
- **Cause of action**: What legal claims are available?
- **Limitation period**: When does the claim expire? (Priority check)
- **Jurisdiction**: Correct court/tribunal? Forum selection clause?
- **Standing**: Does the client have standing to bring the claim?
- **Quantum**: What is the claim worth? Cost-benefit analysis
- **Evidence**: What evidence exists? Can it be obtained?
- **Merits**: Honest assessment of prospects (strong/reasonable/weak)

### 2. Pre-Action Steps
- Preserve evidence (litigation hold notice)
- Without prejudice correspondence
- Pre-action protocol compliance (jurisdiction-specific)
- Demand letter / letter of claim
- Consider interlocutory relief (injunctions, freezing orders)
- Assess insurance coverage (professional indemnity, D&O)

### 3. Document Review & Chronology
- **Litigation hold**: Preserve all relevant documents immediately
- **Chronology**: Build a detailed timeline of key events
- **Cast of characters**: Identify all relevant individuals and their roles
- **Document index**: Catalogue all relevant documents by date and category
- **Privilege review**: Identify legally privileged documents
- **Hot documents**: Flag documents that are particularly helpful or harmful

### 4. Evidence Assessment
- **Documentary evidence**: Contracts, correspondence, emails, records
- **Witness evidence**: Identify potential witnesses, assess credibility
- **Expert evidence**: What expert evidence is needed? (Quantum, technical, industry)
- **Electronic evidence**: ESI preservation, forensic collection if needed

### 5. Cause of Action Analysis
For each potential claim:
- Elements of the cause of action
- Evidence supporting each element
- Gaps in evidence
- Available defences
- Limitation issues
- Remedies available

### 6. Strategy Considerations
- Litigation funding availability
- Costs exposure (own and adverse)
- Settlement leverage points
- Publicity / reputation considerations
- Ongoing commercial relationship
- Alternative dispute resolution — should mediation be attempted first?

## Red Flags
- Limitation period about to expire — urgent action required
- Key documents may have been destroyed
- Witness availability issues
- Inconsistent instructions from client
- Client expectations misaligned with legal merits
- Costs disproportionate to claim value
- Defendant is a person of straw (judgment-proof)

## Skill Prompt

> You are a litigation lawyer preparing a commercial dispute for proceedings. Based on the provided materials: (1) Identify all potential causes of action and assess merits, (2) Check limitation periods, (3) Build a chronology of key events, (4) Catalogue available evidence and identify gaps, (5) Assess quantum of claim, (6) Provide a strategic recommendation (litigate, settle, mediate, or abandon). Include a cost-benefit analysis and risk assessment. Present as a case assessment memorandum.`
  },
  {
    id: 'arbitration',
    name: 'Arbitration Framework',
    path: 'dispute-resolution/arbitration',
    folder: 'dispute-resolution',
    tags: ['dispute', 'arbitration', 'intermediate'],
    jurisdiction: 'Multi-jurisdiction',
    complexity: 'intermediate',
    summary: 'Guide to international and domestic arbitration including clause drafting, seat selection, and enforcement.',
    content: `# Arbitration Framework

## Purpose
Navigate domestic and international arbitration processes, from drafting arbitration clauses to enforcing awards.

## When to Use
- Drafting arbitration clauses for international contracts
- Commencing or responding to arbitration proceedings
- Choosing between institutional and ad hoc arbitration
- Enforcing foreign arbitral awards

## Key Considerations

### 1. Arbitration Clause Essentials
A well-drafted arbitration clause should specify:
- **Scope**: "All disputes arising out of or in connection with this agreement"
- **Seat/Place**: Legal seat of arbitration (determines procedural law)
- **Rules**: Institutional rules (ICC, LCIA, SIAC, ACICA) or UNCITRAL Rules
- **Number of arbitrators**: One or three (cost vs. complexity)
- **Language**: Language of the arbitration
- **Governing law**: Substantive law governing the dispute (may differ from seat)

### 2. Institutional vs. Ad Hoc
**Institutional** (ICC, LCIA, SIAC, ACICA):
- Administered by institution
- Established rules and procedures
- Appointment mechanism if parties can't agree
- Fee schedules (can be expensive for high-value disputes)
- Scrutiny of awards (ICC)

**Ad Hoc** (UNCITRAL Rules):
- More flexible and potentially cheaper
- Parties control the process
- No institutional support
- Risk of procedural delays if parties don't cooperate

### 3. Seat Selection
The seat determines:
- Procedural law (lex arbitri)
- Court supervisory jurisdiction
- Grounds for setting aside the award
- Enforceability under the New York Convention

**Popular seats**: London, Singapore, Hong Kong, Paris, Geneva, Sydney

### 4. Arbitrator Selection
- Qualifications and expertise
- Independence and impartiality
- Nationality restrictions (different from the parties)
- Availability and case load
- Challenge procedures

### 5. Enforcement
- **New York Convention** (1958): Recognition and enforcement of foreign arbitral awards in 170+ countries
- Limited grounds for refusal (Article V):
  - Invalidity of arbitration agreement
  - Lack of due process
  - Award beyond scope of submission
  - Tribunal composition issues
  - Award set aside at seat
  - Public policy

## Model Arbitration Clauses

### ICC
> "All disputes arising out of or in connection with the present contract shall be finally settled under the Rules of Arbitration of the International Chamber of Commerce by one or more arbitrators appointed in accordance with the said Rules."

### ACICA (Australian Centre for International Commercial Arbitration)
> "Any dispute, controversy or claim arising out of, relating to or in connection with this contract, including any question regarding its existence, validity or termination, shall be resolved by arbitration in accordance with the ACICA Arbitration Rules."

## Skill Prompt

> You are an arbitration lawyer advising on a dispute resolution clause or arbitration proceedings. For the provided context: (1) Assess whether arbitration is appropriate for this type of dispute, (2) Recommend institutional rules and seat, (3) Draft or review the arbitration clause, (4) If proceedings are underway, advise on procedural steps, (5) Consider enforcement issues in relevant jurisdictions. Provide specific, actionable recommendations with model clause language where applicable.`
  },
];

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.SKILLS = SKILLS;
  window.FOLDER_META = FOLDER_META;
  window.TAG_CATEGORIES = TAG_CATEGORIES;
}
