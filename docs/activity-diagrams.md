# Activity Diagrams

This file contains activity-diagram-ready flows for the current PLRA system.
You can:

- preview them as Mermaid diagrams in Markdown tools
- use them as the source for redraw in Draw.io
- copy the step logic directly into your report

## 1. User Registration And Login

```mermaid
flowchart TD
    A([Start]) --> B[User opens registration page]
    B --> C[User enters personal details]
    C --> D[System validates required fields]
    D --> E{Valid input?}
    E -- No --> F[Show validation error]
    F --> C
    E -- Yes --> G{Duplicate CNIC or email?}
    G -- Yes --> H[Reject registration and show duplicate error]
    H --> C
    G -- No --> I[Create user account]
    I --> J{Role is Citizen?}
    J -- Yes --> K[Set account as approved]
    J -- No --> L[Set account as pending admin approval]
    K --> M[Registration complete]
    L --> M
    M --> N[User opens login page]
    N --> O[User enters login ID and password]
    O --> P[System validates credentials]
    P --> Q{Citizen using email?}
    Q -- Yes --> R[Reject login and ask for User ID or CNIC]
    R --> O
    Q -- No --> S{Credentials correct?}
    S -- No --> T[Show invalid login message]
    T --> O
    S -- Yes --> U{Approved and active?}
    U -- No --> V[Block login and show approval or status message]
    V --> O
    U -- Yes --> W[Create authenticated session]
    W --> X[Redirect user to role dashboard]
    X --> Y([End])
```

## 2. Property Registration Management

```mermaid
flowchart TD
    A([Start]) --> B[LRO opens property registration form]
    B --> C[LRO enters owner and land details]
    C --> D[System validates required property fields]
    D --> E{Valid property data?}
    E -- No --> F[Show validation error]
    F --> C
    E -- Yes --> G{Duplicate property found?}
    G -- Yes --> H[Reject duplicate registration]
    H --> C
    G -- No --> I[Generate unique property ID]
    I --> J[Create property record with pending status]
    J --> K[Show case in LRO registration queue]
    K --> L[LRO reviews property case]
    L --> M[LRO casts approve or reject vote]
    M --> N{Threshold reached?}
    N -- No --> O[Wait for more LRO votes]
    O --> L
    N -- Yes --> P[Send case to DC final review]
    P --> Q[DC reviews vote history and property details]
    Q --> R{DC approves?}
    R -- No --> S[Mark property registration as rejected]
    S --> T([End])
    R -- Yes --> U[Mark property as approved and active]
    U --> V[Record blockchain or integrity proof]
    V --> W([End])
```

## 3. Property Transfer Management

```mermaid
flowchart TD
    A([Start]) --> B[Seller opens Seller Portal]
    B --> C[Seller lists approved property for sale]
    C --> D{Property eligible for sale?}
    D -- No --> E[Block listing due to hold or encumbrance]
    E --> Z([End])
    D -- Yes --> F[Marketplace shows active listing]
    F --> G[Buyer browses marketplace]
    G --> H[Buyer sends purchase request]
    H --> I[Seller reviews request]
    I --> J{Seller accepts request?}
    J -- No --> K[Mark request as rejected]
    K --> Z
    J -- Yes --> L[Open negotiation channel]
    L --> M[Buyer and seller negotiate terms]
    M --> N{Both agree?}
    N -- No --> M
    N -- Yes --> O[Buyer pays challan and uploads receipt]
    O --> P[Transfer case moves to LRO voting]
    P --> Q[LRO reviews transfer case]
    Q --> R[LRO casts approve or reject vote]
    R --> S{Transfer threshold reached?}
    S -- No --> T[Wait for more LRO votes]
    T --> Q
    S -- Yes --> U[Send transfer case to DC]
    U --> V[DC reviews transfer details]
    V --> W{DC approves?}
    W -- No --> X[Mark transfer as rejected]
    X --> Z
    W -- Yes --> Y[Update property ownership and record blockchain proof]
    Y --> Z([End])
```

## 4. Succession Management

```mermaid
flowchart TD
    A([Start]) --> B[Citizen opens succession page]
    B --> C[System reads owner gender from registered account]
    C --> D{Gender available in profile?}
    D -- No --> E[Ask citizen to complete profile first]
    E --> Z([End])
    D -- Yes --> F[Citizen adds family member details]
    F --> G[System validates relations against owner gender]
    G --> H{Valid family data?}
    H -- No --> I[Show relation or validation error]
    I --> F
    H -- Yes --> J[Citizen requests succession preview]
    J --> K[System calculates inheritance shares]
    K --> L{Valid share result?}
    L -- No --> M[Show preview calculation error]
    M --> F
    L -- Yes --> N[Citizen submits succession request]
    N --> O[LRO reviews succession case]
    O --> P[DC receives case for final decision]
    P --> Q{DC approves?}
    Q -- No --> R[Mark succession request as rejected]
    R --> Z
    Q -- Yes --> S[Finalize succession allocations]
    S --> Z([End])
```

## 5. Property Restriction Management

```mermaid
flowchart TD
    A([Start]) --> B[DC opens restriction dashboard]
    B --> C[DC enters property ID]
    C --> D[System loads property record]
    D --> E{Property found?}
    E -- No --> F[Show property not found error]
    F --> Z([End])
    E -- Yes --> G{Restriction type selected?}
    G -- Freeze or dispute hold --> H[DC enters hold reason and reference]
    G -- Encumbrance --> I[DC enters encumbrance details]
    H --> J[System validates freeze input]
    I --> K[System validates encumbrance input]
    J --> L[Apply property freeze]
    K --> M[Record property encumbrance]
    L --> N[Block sale and transfer actions]
    M --> N
    N --> O([End])
```

## 6. Admin Approval And Recovery

```mermaid
flowchart TD
    A([Start]) --> B[Admin opens admin portal]
    B --> C{Pending officer applications?}
    C -- Yes --> D[Admin reviews LRO or DC registration]
    D --> E{Approve application?}
    E -- Yes --> F[Approve officer account]
    E -- No --> G[Reject officer account]
    F --> H[Record audit log]
    G --> H
    C -- No --> I[Open system health workspace]
    H --> I
    I --> J[Admin checks API, database, Fabric, backups, and ledger health]
    J --> K{Technical issue found?}
    K -- No --> L([End])
    K -- Yes --> M{Issue type}
    M -- Integrity drift --> N[Open integrity watchlist]
    M -- Workflow counter mismatch --> O[Open recovery tools]
    M -- Service failure --> P[Fix infrastructure or restart service]
    N --> Q{Safe mirror rebuild?}
    Q -- Yes --> R[Rebuild integrity mirror]
    Q -- No --> S[Manual technical review]
    O --> T[Run registration, transfer, or full recovery reconcile]
    P --> U[Refresh health status]
    R --> V[Record audit log]
    S --> V
    T --> V
    U --> V
    V --> L([End])
```

## Draw.io Notes

- Use `start/end` as oval shapes.
- Use `process/activity` as rectangles.
- Use `decision` as diamonds.
- Use arrows for control flow.
- If you want cleaner report diagrams, put each actor in a swimlane:
  - User or Citizen
  - System
  - LRO
  - DC
  - Admin

## Best Diagrams For Report

If you only want the most important activity diagrams in your report, use:

1. User Registration And Login
2. Property Registration Management
3. Property Transfer Management
4. Succession Management
