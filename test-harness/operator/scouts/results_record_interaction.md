{
    "grid_selection": {
        "row_structure": "Each row is a `div` with `data-recordid` and `data-rowindex` attributes. The content is within nested divs.",
        "first_record_selectors": [
            "div[data-rowindex='0']",
            "div[data-recordid]"
        ],
        "selection_by_position": "Use the selector `div[data-rowindex='N']` where N is the zero-based index of the row.",
        "selection_by_content": "Use an XPath like `//div[contains(@class, 'cell') and .//div[contains(text(), 'some name')]]/ancestor::div[@data-recordid]`",
        "most_reliable_method": "Selection by `data-recordid` or `data-rowindex` is most reliable."
    },
    "record_view": {
        "open_method": "modal",
        "load_time_ms": 2000,
        "container_selector": "div[role='dialog']",
        "close_methods": [
            "Clicking the 'X' button with selector `div[aria-label=\'Close\']`",
            "Pressing the 'Escape' key",
            "Clicking outside the modal area"
        ],
        "most_reliable_close": "Clicking the 'X' button with selector `div[aria-label=\'Close\']`"
    },
    "field_interactions": {
        "last_contact": {
            "field_type": "datepicker",
            "selectors": [
                "//div[contains(@class, 'cell-container') and .//div[text()='Last Contact']]//div[contains(@class, 'date')]",
                "//div[text()='Last Contact']/following-sibling::div//input"
            ],
            "interaction_sequence": [
                "1. Click the date input to open the date picker.",
                "2. Click the 'Today' button or select a specific day."
            ],
            "date_format_accepted": "Requires interaction with the date picker UI. Direct text input is not reliable."
        },
        "notes": {
            "field_type": "richtext",
            "selectors": [
                "//div[contains(@class, 'cell-container') and .//div[text()='Notes']]//div[@role='textbox']",
                "//div[text()='Notes']/following-sibling::div//div[@contenteditable='true']"
            ],
            "append_method": "click_end_then_type",
            "special_handling": "It's a rich text editor, requires clicking into the editable div before typing. Standard text input commands work for appending."
        }
    },
    "save_mechanism": {
        "auto_save": true,
        "auto_save_delay_ms": 1000,
        "explicit_save_button": null,
        "save_indicators": [
            "A 'Saving...' text appears briefly, followed by 'Saved' text."
        ],
        "verification_method": "The 'Saved' text indicator appears, and changes are reflected in the grid view after closing the modal."
    },
    "recommended_sequence": [
        "1. Click record using: `div[data-rowindex='0']`",
        "2. Wait 2000 ms for modal to load.",
        "3. Update Last Contact by: Clicking the date field and then clicking the 'Today' button in the picker.",
        "4. Update Notes by: Clicking the rich text area for Notes and typing the desired text.",
        "5. Save by: Clicking outside the edited field to trigger the auto-save. Wait for 'Saved' indicator.",
        "6. Close by: Clicking the close button with `div[aria-label=\'Close\']`.",
        "7. Verify by: Observing the updated values in the main grid view."
    ]
}