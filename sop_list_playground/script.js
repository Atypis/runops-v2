document.addEventListener('DOMContentLoaded', () => {
    const sopData = JSON.parse(JSON.stringify({
  "meta": {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "title": "Update Airtable CRM with Investor Email Information from Gmail",
    "version": "0.6.2",
    "goal": "To keep the Airtable Investor Relationship Management CRM up-to-date with the latest communications from investors received via Gmail.",
    "purpose": "To ensure all investor interactions are logged, stages are current, and follow-up actions are identified and recorded, facilitating effective investor relationship management. This process is performed daily.",
    "owner": ["michaelburner5...@gmail.com"]
  },
  "public": {
    "triggers": [
      {
        "type": "manual",
        "description": "User initiates this process daily in the evening to review new investor-related emails and update the CRM."
      }
    ],
    "nodes": [
      {
        "id": "N01_OpenGmail",
        "type": "task",
        "label": "Access Gmail Inbox",
        "intent": "Navigate to or switch to the Gmail tab and ensure the inbox is visible.",
        "context": "Assumes user is already logged into Gmail. If not, login would be an implicit pre-requisite."
      },
      {
        "id": "N02_EmailLoop",
        "type": "loop",
        "label": "Process Each Relevant Email",
        "iterator": "email_in_inbox",
        "children": [
          "N03_OpenEmailInLoop",
          "N04_DecisionIsInvestor",
          "N05_NavigateToAirtableCRM",
          "N06_FindInvestorInCRM",
          "N07_DecisionInvestorExists",
          "N08_ExpandExistingRecord",
          "N09_UpdateExistingRecord",
          "N10_CloseRecordViewExisting",
          "N11_AddNewInvestorRecord",
          "N12_FillNewInvestorDetails",
          "N13_CloseRecordViewNew",
          "N14_ArchiveEmailInGmail"
        ],
        "exit_condition": "All relevant emails in the inbox (e.g., unread or received today) have been processed.",
        "context": "• Iterates through emails in the Gmail inbox.\n• The exact scope (e.g., all unread, all from today, or specific search criteria) needs clarification (see CR04).\n• Assumes emails are processed one by one until no more relevant emails remain."
      },
      {
        "id": "N03_OpenEmailInLoop",
        "type": "task",
        "label": "Open Current Email",
        "intent": "Open the next email from the inbox list for review.",
        "context": "This step involves clicking on an email thread in the Gmail inbox view."
      },
      {
        "id": "N04_DecisionIsInvestor",
        "type": "decision",
        "label": "Is Email Investor-Related?",
        "intent": "Determine if the content of the opened email pertains to an investor communication.",
        "context": "• Based on sender, subject, and email body content.\n• Specific keywords or sender domains might be used (see CR02).\n• If not investor-related (e.g., HR, newsletters, billing), the email is archived without CRM interaction."
      },
      {
        "id": "N05_NavigateToAirtableCRM",
        "type": "task",
        "label": "Navigate to Airtable Investor CRM",
        "intent": "Open or switch to the Airtable tab and navigate to the 'Investor Relationship Management App' base.",
        "context": "• If Airtable or the specific base is not open, this involves opening a new tab, navigating to airtable.com, and selecting the base.\n• If already open, this might just be a tab switch.\n• Assumes user is logged into Airtable (see CR03)."
      },
      {
        "id": "N06_FindInvestorInCRM",
        "type": "task",
        "label": "Find Investor in CRM",
        "intent": "Locate the record for the investor mentioned in the email within the Airtable base.",
        "context": "• Typically involves visually scanning the 'Investor Name' column or using Airtable's search/filter capabilities.\n• The investor's name is extracted from the email content."
      },
      {
        "id": "N07_DecisionInvestorExists",
        "type": "decision",
        "label": "Investor Exists in CRM?",
        "intent": "Determine if a record for this investor already exists in the CRM."
      },
      {
        "id": "N08_ExpandExistingRecord",
        "type": "task",
        "label": "Expand Existing Investor Record",
        "intent": "Open the detailed view for the found investor record.",
        "context": "This involves clicking the expand icon next to the investor's row in the Airtable grid."
      },
      {
        "id": "N09_UpdateExistingRecord",
        "type": "task",
        "label": "Update Existing Investor Record",
        "intent": "Review and update the investor's record details based on the email.",
        "context": "• Fields to check/update: 'Stage', 'Last Interaction' date, 'Thread Summary / Notes', 'Follow-up Needed' checkbox, 'Next Step / Action'. If information in CRM is already current with the email, no changes might be made, but the record is still reviewed."
      },
      {
        "id": "N10_CloseRecordViewExisting",
        "type": "task",
        "label": "Close Expanded Record View (Existing)",
        "intent": "Close the detailed view of the investor record, returning to the grid view."
      },
      {
        "id": "N11_AddNewInvestorRecord",
        "type": "task",
        "label": "Add New Investor Record",
        "intent": "Create a new row/record in Airtable for an investor not currently in the CRM.",
        "context": "This typically involves clicking an 'add row' button, which opens a new record form."
      },
      {
        "id": "N12_FillNewInvestorDetails",
        "type": "task",
        "label": "Fill New Investor Details",
        "intent": "Populate the fields for the new investor record using information from the email.",
        "context": "• Key fields: 'Investor Name', 'Contact Person', 'Email', 'Stage', 'Last Interaction' date, 'Thread Summary / Notes', 'Follow-up Needed', 'Next Step / Action'. See CR06 for clarification on required/default fields."
      },
      {
        "id": "N13_CloseRecordViewNew",
        "type": "task",
        "label": "Close Record Form (New)",
        "intent": "Save and close the new investor record form, returning to the grid view."
      },
      {
        "id": "N14_ArchiveEmailInGmail",
        "type": "task",
        "label": "Archive Email in Gmail",
        "intent": "Archive the processed email in Gmail to remove it from the inbox.",
        "context": "• Typically involves selecting the email's checkbox (if not already open in its own view) and clicking the 'Archive' button.\n• If the email was opened, navigating back to inbox list might be needed first before archiving, or archiving from the email view itself."
      },
      {
        "id": "N15_EndProcess",
        "type": "end",
        "label": "End Email Processing Workflow"
      }
    ],
    "edges": [
      { "source": "N01_OpenGmail", "target": "N02_EmailLoop", "condition": "start" },
      { "source": "N03_OpenEmailInLoop", "target": "N04_DecisionIsInvestor", "condition": "next" },
      { "source": "N04_DecisionIsInvestor", "target": "N05_NavigateToAirtableCRM", "condition": "yes" },
      { "source": "N04_DecisionIsInvestor", "target": "N14_ArchiveEmailInGmail", "condition": "no" },
      { "source": "N05_NavigateToAirtableCRM", "target": "N06_FindInvestorInCRM", "condition": "next" },
      { "source": "N06_FindInvestorInCRM", "target": "N07_DecisionInvestorExists", "condition": "next" },
      { "source": "N07_DecisionInvestorExists", "target": "N08_ExpandExistingRecord", "condition": "yes" },
      { "source": "N08_ExpandExistingRecord", "target": "N09_UpdateExistingRecord", "condition": "next" },
      { "source": "N09_UpdateExistingRecord", "target": "N10_CloseRecordViewExisting", "condition": "next" },
      { "source": "N10_CloseRecordViewExisting", "target": "N14_ArchiveEmailInGmail", "condition": "next" },
      { "source": "N07_DecisionInvestorExists", "target": "N11_AddNewInvestorRecord", "condition": "no" },
      { "source": "N11_AddNewInvestorRecord", "target": "N12_FillNewInvestorDetails", "condition": "next" },
      { "source": "N12_FillNewInvestorDetails", "target": "N13_CloseRecordViewNew", "condition": "next" },
      { "source": "N13_CloseRecordViewNew", "target": "N14_ArchiveEmailInGmail", "condition": "next" },
      { "source": "N14_ArchiveEmailInGmail", "target": "N02_EmailLoop", "condition": "next" },
      { "source": "N02_EmailLoop", "target": "N15_EndProcess", "condition": "all_processed" }
    ],
    "variables": {
      "gmail_url": "https://mail.google.com/",
      "airtable_url": "https://airtable.com/",
      "airtable_base_name": "Investor Relationship Management App",
      "current_email_sender": "string",
      "current_email_subject": "string",
      "current_email_content_summary": "string",
      "current_email_date": "string (date)",
      "investor_name_from_email": "string",
      "airtable_investor_name_field": "Investor Name",
      "airtable_contact_person_field": "Contact Person",
      "airtable_email_field": "Email",
      "airtable_stage_field": "Stage",
      "airtable_last_interaction_field": "Last Interaction",
      "airtable_notes_field": "Thread Summary / Notes",
      "airtable_follow_up_needed_field": "Follow-up Needed",
      "airtable_next_step_action_field": "Next Step / Action"
    },
    "clarification_requests": [
      { "id": "CR01", "question": "The narrator states this workflow is done 'every evening'. Would a 'cron' type trigger (e.g., 'RRULE:FREQ=DAILY;BYHOUR=18') be more appropriate if automation is desired, or is it always manually started?", "importance": "medium" },
      { "id": "CR02", "question": "What specific criteria (e.g., sender domains, keywords in subject/body, predefined contact list) are used to determine if an email is 'investor-related' at node N04_DecisionIsInvestor?", "importance": "high" },
      { "id": "CR03", "question": "The SOP assumes the user is already logged into Gmail and Airtable. Should steps for logging in be explicitly included if sessions are not active?", "importance": "medium" },
      { "id": "CR04", "question": "What is the precise scope of emails to be processed by the N02_EmailLoop? (e.g., all unread emails, emails received 'today', emails matching a specific search query).", "importance": "high" },
      { "id": "CR05", "question": "The 'Last Interaction' date in Airtable is consistently set to 'April 22nd, 2025' in the demo, even for emails that may have different receipt dates. What is the rule for setting the 'Last Interaction' date? Should it be the actual email receipt date, the date of CRM update, or another specific logic?", "importance": "high" },
      { "id": "CR06", "question": "When adding a new investor (N11, N12), are there any default values or a complete list of strictly required fields beyond what was demonstrated (Investor Name, Contact Person, Email, Stage, Last Interaction, Notes, Follow-up Needed, Next Step)?", "importance": "medium" },
      { "id": "CR07", "question": "For non-investor emails (e.g., HR, newsletters, billing), the demo shows some being archived directly from the inbox list without opening them first. The current SOP implies opening an email (N03) before deciding its relevance (N04). How should these 'obviously non-investor' emails be handled? Should there be a pre-filtering step or a different path for them?", "importance": "medium" }
    ]
  },
  "private": {
    "skills": [
      { "id": "SK01_Gmail_AccessInbox", "app": "Gmail (via Google Chrome)", "method_type": "ui" },
      { "id": "SK02_Gmail_OpenEmailThread", "app": "Gmail (via Google Chrome)", "method_type": "ui", "variables_in": ["email_identifier_in_list"] },
      { "id": "SK03_Gmail_ExtractInformation", "app": "Gmail (via Google Chrome)", "method_type": "ui", "variables_out": ["sender_email", "email_subject", "email_body_summary", "email_date_received", "investor_name_guess", "contact_person_guess"] },
      { "id": "SK04_Gmail_ArchiveEmail", "app": "Gmail (via Google Chrome)", "method_type": "ui", "variables_in": ["email_identifier"] },
      { "id": "SK05_Airtable_NavigateAndOpenBase", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_in": ["airtable_url", "airtable_base_name"] },
      { "id": "SK06_Airtable_FindRecordVisualScan", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_in": ["investor_name_from_email"], "variables_out": ["record_found_boolean", "airtable_record_id_if_found"] },
      { "id": "SK07_Airtable_ExpandRecord", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_in": ["airtable_record_id_if_found"] },
      { "id": "SK08_Airtable_UpdateExistingRecordFields", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_in": ["airtable_record_id", "field_data_to_update_object"] },
      { "id": "SK09_Airtable_CloseRecordModal", "app": "Airtable (via Google Chrome)", "method_type": "ui" },
      { "id": "SK10_Airtable_InitiateNewRecord", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_out": ["new_airtable_record_id"] },
      { "id": "SK11_Airtable_FillNewRecordFields", "app": "Airtable (via Google Chrome)", "method_type": "ui", "variables_in": ["new_airtable_record_id", "field_data_for_new_record_object"] },
      { "id": "SK12_Browser_SwitchTab", "app": "Google Chrome", "method_type": "ui", "variables_in": ["target_tab_identifier"] },
      { "id": "SK13_Browser_CopyText", "app": "Google Chrome", "method_type": "ui", "variables_out": ["copied_text"] },
      { "id": "SK14_Browser_PasteText", "app": "Google Chrome", "method_type": "ui", "variables_in": ["text_to_paste", "target_field_identifier"] },
      { "id": "SK_API_G01_Gmail_FetchEmails", "app": "Gmail", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["query_parameters"], "variables_out": ["list_of_emails"] },
      { "id": "SK_API_G02_Gmail_GetEmailDetails", "app": "Gmail", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["email_id"], "variables_out": ["email_object_details"] },
      { "id": "SK_API_G03_Gmail_ArchiveEmail", "app": "Gmail", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["email_id"] },
      { "id": "SK_API_A01_Airtable_ListRecords", "app": "Airtable", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["base_id", "table_id", "filter_formula"], "variables_out": ["list_of_records"] },
      { "id": "SK_API_A02_Airtable_UpdateRecord", "app": "Airtable", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["base_id", "table_id", "record_id", "fields_to_update_object"] },
      { "id": "SK_API_A03_Airtable_CreateRecord", "app": "Airtable", "method_type": "api", "performance_hint": "placeholder - awaiting confirmation", "variables_in": ["base_id", "table_id", "fields_for_new_record_object"], "variables_out": ["created_record_object"] }
    ],
    "steps": [
      { "node_id": "N01_OpenGmail", "primary_skill": "SK01_Gmail_AccessInbox", "alt_skills": ["SK_API_G01_Gmail_FetchEmails"] },
      { "node_id": "N03_OpenEmailInLoop", "primary_skill": "SK02_Gmail_OpenEmailThread", "alt_skills": ["SK_API_G02_Gmail_GetEmailDetails"] },
      { "node_id": "N04_DecisionIsInvestor", "primary_skill": "SK03_Gmail_ExtractInformation" },
      { "node_id": "N05_NavigateToAirtableCRM", "primary_skill": "SK05_Airtable_NavigateAndOpenBase" },
      { "node_id": "N06_FindInvestorInCRM", "primary_skill": "SK06_Airtable_FindRecordVisualScan", "alt_skills": ["SK_API_A01_Airtable_ListRecords"] },
      { "node_id": "N08_ExpandExistingRecord", "primary_skill": "SK07_Airtable_ExpandRecord" },
      { "node_id": "N09_UpdateExistingRecord", "primary_skill": "SK08_Airtable_UpdateExistingRecordFields", "alt_skills": ["SK_API_A02_Airtable_UpdateRecord"] },
      { "node_id": "N10_CloseRecordViewExisting", "primary_skill": "SK09_Airtable_CloseRecordModal" },
      { "node_id": "N11_AddNewInvestorRecord", "primary_skill": "SK10_Airtable_InitiateNewRecord", "alt_skills": ["SK_API_A03_Airtable_CreateRecord"] },
      { "node_id": "N12_FillNewInvestorDetails", "primary_skill": "SK11_Airtable_FillNewRecordFields", "alt_skills": ["SK_API_A03_Airtable_CreateRecord"] },
      { "node_id": "N13_CloseRecordViewNew", "primary_skill": "SK09_Airtable_CloseRecordModal" },
      { "node_id": "N14_ArchiveEmailInGmail", "primary_skill": "SK04_Gmail_ArchiveEmail", "alt_skills": ["SK_API_G03_Gmail_ArchiveEmail"] }
    ],
    "artifacts": []
  }
}));

    // --- Populating Header --- 
    document.getElementById('sop-title').textContent = sopData.meta.title;
    document.getElementById('sop-goal').textContent = sopData.meta.goal;
    document.getElementById('sop-purpose').textContent = sopData.meta.purpose;
    document.getElementById('sop-owner').textContent = sopData.meta.owner.join(', ');
    document.getElementById('sop-version').textContent = sopData.meta.version;

    // --- Populating Trigger Display Area ---
    const triggerDisplayArea = document.getElementById('sop-trigger-display-area');
    triggerDisplayArea.innerHTML = ''; // Clear previous content
    const triggerUl = document.createElement('ul');
    const triggerHeader = document.createElement('h3');
    triggerHeader.textContent = 'Trigger(s)';
    triggerDisplayArea.appendChild(triggerHeader);
    sopData.public.triggers.forEach(trigger => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${trigger.type.toUpperCase()}:</strong> ${trigger.description || ''}`;
        triggerUl.appendChild(li);
    });
    triggerDisplayArea.appendChild(triggerUl);
    
    const sidebarTriggersSection = document.getElementById('sidebar-triggers-section');
    if (sidebarTriggersSection) sidebarTriggersSection.style.display = 'none';


    // --- Populating Sidebar (Variables, Clarifications, Artifacts) --- 
    const variablesList = document.getElementById('sop-variables-list');
    variablesList.innerHTML = ''; // Clear previous
    if (sopData.public.variables) {
        Object.entries(sopData.public.variables).forEach(([key, value]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${key}:</strong> ${value}`;
            variablesList.appendChild(li);
        });
    }

    const clarificationsList = document.getElementById('sop-clarifications-list');
    clarificationsList.innerHTML = ''; // Clear previous
    if (sopData.public.clarification_requests) {
        sopData.public.clarification_requests.forEach(req => {
            const li = document.createElement('li');
            li.className = `clarification-item importance-${req.importance.toLowerCase()}`;
            li.innerHTML = `<span class="importance-tag ${req.importance.toLowerCase()}">${req.importance.toUpperCase()}</span> <strong>${req.id}:</strong> ${req.question}`;
            clarificationsList.appendChild(li);
        });
    }
    
    const artifactsList = document.getElementById('sop-artifacts-list');
    artifactsList.innerHTML = ''; // Clear previous
    if (sopData.private && sopData.private.artifacts && sopData.private.artifacts.length > 0) {
        sopData.private.artifacts.forEach(artifact => {
            const li = document.createElement('li');
            li.textContent = JSON.stringify(artifact); // Or a more structured display
            artifactsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = "No artifacts defined.";
        artifactsList.appendChild(li);
    }

    // --- Populating SOP Steps --- 
    const stepsListContainer = document.getElementById('sop-steps-list');
    stepsListContainer.innerHTML = ''; // Clear previous steps
    const nodesById = sopData.public.nodes.reduce((acc, node) => { acc[node.id] = node; return acc; }, {});
    const edgesBySource = sopData.public.edges.reduce((acc, edge) => {
        if (!acc[edge.source]) acc[edge.source] = [];
        acc[edge.source].push(edge);
        return acc;
    }, {});

    const nodeToStepNumberMap = {}; 
    let globalStepCounter = 1;
    const renderedNodeIds = new Set(); 

    function getSkillInfo(nodeId) {
        if (!sopData.private || !sopData.private.steps || !sopData.private.skills) return '';
        const stepPlan = sopData.private.steps.find(s => s.node_id === nodeId);
        if (!stepPlan) return 'No skill plan defined.';

        const primarySkill = sopData.private.skills.find(s => s.id === stepPlan.primary_skill);
        let skillHtml = `<strong>Primary Skill:</strong> ${primarySkill ? `${primarySkill.app} (${primarySkill.method_type})` : 'N/A'}`; 

        if (stepPlan.alt_skills && stepPlan.alt_skills.length > 0) {
            const altSkillDetails = stepPlan.alt_skills.map(altId => {
                const altSkill = sopData.private.skills.find(s => s.id === altId);
                return altSkill ? `${altSkill.app} (${altSkill.method_type}) – <em>${altSkill.performance_hint || 'Alternative available'}</em>` : 'Unknown alt skill';
            }).join('<br>Alternative: ');
            if (altSkillDetails) skillHtml += `<br>Alternative: ${altSkillDetails}`;
        }
        return skillHtml;
    }

    function buildNodeListItem(node, level, currentStepNumberStr) {
        nodeToStepNumberMap[node.id] = currentStepNumberStr;
        const li = document.createElement('li');
        li.id = `step-li-${node.id}`;
        li.className = `sop-step-item ${node.type}-node`;
        if (level > 0) li.classList.add('indented-step');

        let detailsHtml = '';
        if (node.context || (sopData.private && sopData.private.steps)) {
            detailsHtml = `
                <details class="step-details">
                    <summary>Context & Skills</summary>
                    ${node.context ? `<p><strong>Context:</strong> ${node.context.replace(/\n/g, '<br>')}</p>` : ''}
                    <div class="skill-info">${getSkillInfo(node.id)}</div>
                </details>
            `;
        }
        
        let loopInfoHtml = '';
        if (node.type === 'loop') {
            loopInfoHtml = `
                <div class="loop-iterator"><strong>Iterating over:</strong> ${node.iterator}</div>
                <div class="loop-exit-condition"><strong>Exits when:</strong> ${node.exit_condition}</div>
            `;
        }

        li.innerHTML = `
            <div class="step-header">
                <span class="step-number">${currentStepNumberStr}.</span>
                <span class="step-label">${node.label}</span>
            </div>
            ${node.intent ? `<p class="step-intent">${node.intent}</p>` : ''}
            ${loopInfoHtml}
            ${detailsHtml}
        `;
        
        if (node.type === 'decision') {
            const outgoing = edgesBySource[node.id] || [];
            outgoing.forEach(edge => {
                const targetNode = nodesById[edge.target];
                if (targetNode) {
                    const annotation = document.createElement('div');
                    annotation.className = 'contextual-jump-annotation';
                    annotation.innerHTML = `<span class="jump-arrow">↪</span> If <strong>${edge.condition.toUpperCase()}</strong>: <a href="#step-li-${targetNode.id}" data-targetid="${targetNode.id}">Proceeds to (${targetNode.label})</a>`;
                    li.appendChild(annotation);
                }
            });
        }
        return li;
    }
    
    sopData.public.nodes.forEach(node => {
        if (renderedNodeIds.has(node.id)) return;

        const isChildOfAnotherLoop = sopData.public.nodes.some(p => 
            p.id !== node.id && p.type === 'loop' && p.children && p.children.includes(node.id)
        );
        if (isChildOfAnotherLoop && node.type !== 'loop') return;

        let currentStepNumberStr = globalStepCounter.toString();
        const listItem = buildNodeListItem(node, 0, currentStepNumberStr);
        stepsListContainer.appendChild(listItem);
        renderedNodeIds.add(node.id);
        globalStepCounter++;

        const primaryOutgoingEdges = (edgesBySource[node.id] || []);
        const primaryNextEdge = primaryOutgoingEdges.find(e => e.condition === 'next');
        
        if (primaryNextEdge && node.type !== 'loop') {
            const targetNode = nodesById[primaryNextEdge.target];
            const currentNodeIndex = sopData.public.nodes.findIndex(n => n.id === nodeId);
            const nextNodeInArray = (currentNodeIndex + 1 < sopData.public.nodes.length) ? sopData.public.nodes[currentNodeIndex + 1] : null;
            
            if (targetNode && (!nextNodeInArray || targetNode.id !== nextNodeInArray.id)) {
                const annotation = document.createElement('div');
                annotation.className = 'contextual-jump-annotation';
                annotation.innerHTML = `<span class="jump-arrow">➡️</span> Next: <a href="#step-li-${targetNode.id}" data-targetid="${targetNode.id}">Proceeds to (${targetNode.label})</a>`;
                listItem.appendChild(annotation);
            }
        }

        if (node.type === 'loop' && node.children) {
            node.children.forEach((childId, childIndex) => {
                const childNode = nodesById[childId];
                if (childNode && !renderedNodeIds.has(childId)) {
                    const childStepNumberStr = `${nodeToStepNumberMap[node.id]}.${childIndex + 1}`;
                    const childListItem = buildNodeListItem(childNode, 1, childStepNumberStr);
                    stepsListContainer.appendChild(childListItem);
                    renderedNodeIds.add(childId);
                }
            });
            const allProcessedEdge = primaryOutgoingEdges.find(e => e.condition === 'all_processed');
            if (allProcessedEdge) {
                const targetNode = nodesById[allProcessedEdge.target];
                if (targetNode) {
                    const annotation = document.createElement('div');
                    annotation.className = 'contextual-jump-annotation';
                    annotation.innerHTML = `<span class="jump-arrow">➡️</span> When all processed: <a href="#step-li-${targetNode.id}" data-targetid="${targetNode.id}">Proceeds to (${targetNode.label})</a>`;
                    listItem.appendChild(annotation);
                }
            }
        }
    });

    document.querySelectorAll('.contextual-jump-annotation a').forEach(link => {
        const targetId = link.dataset.targetid;
        const targetNode = nodesById[targetId];
        const targetStepNumber = nodeToStepNumberMap[targetId];
        if (targetNode && targetStepNumber) {
            const originalTextStart = link.innerHTML.substring(0, link.innerHTML.indexOf('('));
            link.innerHTML = `${originalTextStart}Step ${targetStepNumber} (${targetNode.label})`;
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            try {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    targetElement.classList.add('highlight-step');
                    setTimeout(() => targetElement.classList.remove('highlight-step'), 1500);
                }
            } catch (error) {
                console.warn("Smooth scroll target not found or invalid:", targetId, error);
            }
        });
    });
    
    let styleSheet = document.styleSheets[0];
    if (styleSheet && !Array.from(styleSheet.cssRules).some(rule => rule.selectorText === '.highlight-step')) {
        styleSheet.insertRule('.highlight-step { background-color: #fff3cd !important; transition: background-color 0.5s ease-out; }', styleSheet.cssRules.length);
    }
}); 