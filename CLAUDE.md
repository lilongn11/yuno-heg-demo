# Project: Yuno SDK Demo

## What I'm Building
A demo app showing integration 
using specific flow and integration type 

## Key Docs
- API reference: /docs/api-reference.md if its not available check the online version https://docs.y.uno/reference/api-reference-overview , look at the relevant section
- Full docs: /docs/api-docs.md if its not available check the online documentation look at the relevant section
- Sample code: /sample/ ， if its not available check this online repository https://github.com/yuno-payments/yuno-sdk-web.git

## Rules
- Read the /sample/README.md to get a overview of the sample demo based on the integration methold to decide which sample code to take as reference
- Stack: use the same stack of sample 
- project architecture: take the sample as reference
- App must run with: npm install && npm start

## Before build
- ask what flow is involved , payment flow or enrollment flow or both
- ask which integration methold to use for each flow 
- build plan based on the info 

---

## Phase 3: The Build Workflow
*The repeatable process*

### Step 7 — Orient Claude First (Don't Skip This)
```
Read CLAUDE.md, all files in /docs, and the relevant sample in /sample.

Then tell me:
1. What this API does
2. How auth works
3. The 3 most important endpoints
4. Any gotchas you noticed in the sample code
```
✅ Verify the summary is correct before proceeding

### Step 8 — Plan Before Coding
```
Based on the docs, propose a file/folder structure 
for the demo. List each file and what it will do.
Do NOT write any code yet.
```
Review the plan. Correct anything wrong. Then say **"go ahead"**.

### Step 9 — Build Layer by Layer
Always build in this order:
```
Round 1: "Build only the API client / auth layer"
         → test it works

Round 2: "Now add data fetching for [endpoint X]"
         → test it works

Round 3: "Now build the UI to display the data"
         → test it works

Round 4: "Add error handling and loading states"
         → test it works
```
**Never skip ahead. Each layer must work before the next.**

### Step 10 — Validate Each Layer
After each build step, run this prompt:
```
Explain what you just built in plain English.
What would cause this to break?
Run it and confirm there are no errors.
```

---

## Phase 4: Debugging Loop
*When things go wrong*

### Step 11 — Feed Errors Directly
```
Running the app gives this error:
[paste exact error]

The relevant code is in [file].
Fix it without changing anything else.
```

### Step 12 — When Claude Goes Off Track
```
Stop. This doesn't match the pattern in /sample/auth.js.
Go back and re-read that file, then redo this step.
```

### Step 13 — When the Demo Doesn't Match Docs
```
The API reference says [X] but you implemented [Y].
Re-read /docs/api-reference.md section [Z] and correct this.
```

---

## Phase 5: Level Up
*After your first successful demo*

### Step 14 — Build a Personal Template
After your first demo, save:
- Your best `CLAUDE.md` as a template
- Your best opening prompts
- Your layer-by-layer build sequence

### Step 15 — Practice With Progressively Complex APIs
Start simple → go complex:
