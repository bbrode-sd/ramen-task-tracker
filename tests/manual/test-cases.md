# Tomobodo - Manual Test Cases

This document contains all manual test cases for QA testing of the Tomobodo application.

## Test Environment Setup

### Prerequisites
- Modern browser (Chrome, Firefox, Safari, Edge)
- Test account with Google sign-in
- Network connectivity (for testing, can be toggled for offline tests)

### Test Data
- Create a test board named "QA Test Board"
- Create 3 columns: "To Do", "In Progress", "Done"
- Create 5+ cards with various labels, due dates, and checklists

---

## TC-AUTH: Authentication Test Cases

### TC-AUTH-001: Google Sign-In Success
**Priority:** Critical  
**Preconditions:** User is not signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to homepage | Login screen displays with "Sign in with Google" button |
| 2 | Click "Sign in with Google" | Google OAuth popup appears |
| 3 | Complete Google authentication | Redirect to board list page |
| 4 | Verify user info | User avatar and name appear in header |

**Notes:** Test with different Google accounts (personal, work)

---

### TC-AUTH-002: Sign-In Error Handling
**Priority:** High  
**Preconditions:** User is not signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to homepage | Login screen displays |
| 2 | Click "Sign in with Google" | OAuth popup appears |
| 3 | Cancel or close the popup | Error toast appears with message |
| 4 | Verify app state | App remains on login screen, no crash |

---

### TC-AUTH-003: Sign-Out Clears Session
**Priority:** Critical  
**Preconditions:** User is signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click user avatar/profile | Profile menu appears |
| 2 | Click "Sign out" | User is signed out |
| 3 | Verify redirect | Redirects to login screen |
| 4 | Navigate to /boards | Redirects back to login (protected route) |
| 5 | Clear localStorage check | User data is cleared from storage |

---

### TC-AUTH-004: Session Persistence on Refresh
**Priority:** High  
**Preconditions:** User is signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to a board | Board displays correctly |
| 2 | Refresh the page (F5) | Page reloads |
| 3 | Verify authentication | User remains signed in |
| 4 | Verify board state | Same board displays with data intact |

---

### TC-AUTH-005: Anonymous Mode (Test Environment)
**Priority:** Medium  
**Preconditions:** NEXT_PUBLIC_SKIP_AUTH=true in environment

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to homepage | Bypasses login screen |
| 2 | Verify board list | Board list displays immediately |
| 3 | Create a board | Board is created with test user |
| 4 | Verify operations | All CRUD operations work |

---

## TC-BOARD: Board Management Test Cases

### TC-BOARD-001: Create Blank Board
**Priority:** Critical  
**Preconditions:** User is signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create Board" button | Board creation modal/options appear |
| 2 | Select "Blank Board" | New board is created |
| 3 | Verify navigation | Redirects to new board page |
| 4 | Verify board state | Board has default name, no columns |

---

### TC-BOARD-002: Create Board from Template
**Priority:** High  
**Preconditions:** User is signed in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create Board" button | Template options appear |
| 2 | Select "Sprint Board" template | New board is created |
| 3 | Verify columns | Board has Backlog, In Progress, Review, Done |
| 4 | Verify board name | Board is named "Sprint Board" |

---

### TC-BOARD-003: Edit Board Name
**Priority:** Medium  
**Preconditions:** User is on a board they own

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on board name in header | Name becomes editable |
| 2 | Type new name "Renamed Board" | Input shows new name |
| 3 | Press Enter or click away | Name is saved |
| 4 | Refresh page | New name persists |

---

### TC-BOARD-004: Change Background
**Priority:** Low  
**Preconditions:** User is on a board they own

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click More menu (⋯) | Menu appears |
| 2 | Click "Background" | Background picker opens |
| 3 | Select a gradient | Background changes immediately |
| 4 | Select a solid color | Background updates |
| 5 | Upload custom image | Background shows image |
| 6 | Refresh page | Background persists |

---

### TC-BOARD-005: Add Member by Email
**Priority:** High  
**Preconditions:** User is board owner

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Share" button | Share modal opens |
| 2 | Enter valid member email | Email appears in input |
| 3 | Click "Add" | Member is added to list |
| 4 | Verify member access | New member can access board |

---

### TC-BOARD-006: Remove Member
**Priority:** Medium  
**Preconditions:** Board has members besides owner

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Share modal | Member list displays |
| 2 | Click remove (X) on member | Confirmation appears |
| 3 | Confirm removal | Member is removed from list |
| 4 | Verify access revoked | Member can no longer access board |

---

### TC-BOARD-007: Export Board (JSON/CSV)
**Priority:** Medium  
**Preconditions:** Board has columns and cards

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click More menu (⋯) | Menu appears |
| 2 | Click "Export/Import" | Export modal opens |
| 3 | Click "Export JSON" | JSON file downloads |
| 4 | Verify file contents | File contains board data |
| 5 | Click "Export CSV" | CSV file downloads |
| 6 | Open CSV in Excel | Data displays correctly |

---

### TC-BOARD-008: Import Board
**Priority:** Medium  
**Preconditions:** Have export file or Trello JSON

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click More menu → Export/Import | Modal opens |
| 2 | Click "Import" tab | Import interface shows |
| 3 | Select valid JSON file | Preview shows |
| 4 | Click "Import" | New board is created |
| 5 | Verify imported data | Columns, cards, comments imported |

---

## TC-COL: Column Operations Test Cases

### TC-COL-001: Create Column
**Priority:** Critical  
**Preconditions:** User is on a board

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Column" button | Column creation appears |
| 2 | Type "New Column" | Name is entered |
| 3 | Press Enter | Column is created |
| 4 | Verify position | Column appears at the end |

---

### TC-COL-002: Rename Column
**Priority:** Medium  
**Preconditions:** Board has columns

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click column header or menu | Edit mode or menu appears |
| 2 | Select "Rename" | Name becomes editable |
| 3 | Type new name | Name updates |
| 4 | Press Enter | Name is saved |

---

### TC-COL-003: Reorder Columns (Drag)
**Priority:** High  
**Preconditions:** Board has 3+ columns

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click and hold column header | Column lifts |
| 2 | Drag to new position | Visual feedback shows drop zone |
| 3 | Drop column | Column moves to new position |
| 4 | Refresh page | New order persists |

---

### TC-COL-004: Archive Column
**Priority:** Medium  
**Preconditions:** Board has columns

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click column menu (⋯) | Menu appears |
| 2 | Click "Archive Column" | Confirmation appears |
| 3 | Confirm archive | Column disappears |
| 4 | Open Archive drawer | Column appears in archive |

---

### TC-COL-005: Restore Column
**Priority:** Medium  
**Preconditions:** Archived column exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Archive drawer | Archived items show |
| 2 | Find archived column | Column is listed |
| 3 | Click "Restore" | Column reappears on board |
| 4 | Verify position | Column at original position or end |

---

### TC-COL-006: Archive All Cards in Column
**Priority:** Low  
**Preconditions:** Column has cards

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click column menu (⋯) | Menu appears |
| 2 | Click "Archive all cards" | Confirmation appears |
| 3 | Confirm action | All cards disappear |
| 4 | Verify archive | Cards appear in archive |
| 5 | Column still exists | Column remains empty |

---

## TC-CARD: Card Operations Test Cases

### TC-CARD-001: Create Card
**Priority:** Critical  
**Preconditions:** Board has a column

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add card" in column | Input field appears |
| 2 | Type "Test Card" | Text is entered |
| 3 | Press Enter | Card is created |
| 4 | Verify card displays | EN title shows, JP is translating |

---

### TC-CARD-002: Edit Card Title/Description
**Priority:** Critical  
**Preconditions:** Card exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on card | Card modal opens |
| 2 | Edit EN title | Title updates |
| 3 | Edit EN description | Description updates |
| 4 | Edit JP title manually | JP title updates |
| 5 | Close modal | Changes are saved |

---

### TC-CARD-003: Add/Remove Labels
**Priority:** High  
**Preconditions:** Card modal is open

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Labels section | Label input appears |
| 2 | Type "Bug" | Label is typed |
| 3 | Press Enter | Label is added |
| 4 | Verify on card | Label badge appears |
| 5 | Click X on label | Label is removed |

---

### TC-CARD-004: Set Due Date
**Priority:** High  
**Preconditions:** Card modal is open

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Due Date section | Date picker appears |
| 2 | Select tomorrow | Date is set |
| 3 | Verify card | Due date badge shows |
| 4 | Set date to yesterday | Badge shows "overdue" style |

---

### TC-CARD-005: Add Assignee
**Priority:** Medium  
**Preconditions:** Board has members

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Assignees section | Member list appears |
| 2 | Click on a member | Member is assigned |
| 3 | Verify card | Avatar appears on card |
| 4 | Remove assignee | Avatar disappears |

---

### TC-CARD-006: Add Checklist with Items
**Priority:** Medium  
**Preconditions:** Card modal is open

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Add Checklist | Checklist form appears |
| 2 | Name it "Tasks" | Name is entered |
| 3 | Add item "Task 1" | Item appears |
| 4 | Add item "Task 2" | Second item appears |
| 5 | Check off Task 1 | Item shows checked |
| 6 | Verify progress | Shows "1/2" on card |

---

### TC-CARD-007: Upload Attachment (File/Image)
**Priority:** Medium  
**Preconditions:** Card modal is open

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Attachments | Upload area appears |
| 2 | Select image file | Upload starts |
| 3 | Wait for upload | Thumbnail appears |
| 4 | Upload PDF file | File icon appears |
| 5 | Click attachment | Opens in new tab |

---

### TC-CARD-008: Paste Image
**Priority:** Low  
**Preconditions:** Image copied to clipboard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open card modal | Modal is open |
| 2 | Ctrl/Cmd+V in attachment area | Paste detected |
| 3 | Wait for upload | Image appears as attachment |

---

### TC-CARD-009: Add Cover (Image/Color)
**Priority:** Low  
**Preconditions:** Card has image attachment or modal open

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Cover section | Cover options appear |
| 2 | Select a color | Color cover appears on card |
| 3 | Select image attachment | Image cover appears |
| 4 | Remove cover | Cover disappears |

---

### TC-CARD-010: Drag Card Between Columns
**Priority:** Critical  
**Preconditions:** Board has multiple columns with cards

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click and hold card | Card lifts with shadow |
| 2 | Drag to another column | Drop zone highlights |
| 3 | Drop card | Card moves to new column |
| 4 | Refresh page | Position persists |

---

### TC-CARD-011: Multi-Select Cards (Shift-Click)
**Priority:** Medium  
**Preconditions:** Column has multiple cards

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click first card | Card is selected |
| 2 | Shift+click third card | Cards 1-3 selected |
| 3 | Drag selected cards | All cards move together |
| 4 | Drop in new column | All cards moved |

---

### TC-CARD-012: Archive/Restore Card
**Priority:** High  
**Preconditions:** Card exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open card modal | Modal opens |
| 2 | Click Archive | Confirmation appears |
| 3 | Confirm archive | Card disappears, modal closes |
| 4 | Open Archive drawer | Card is listed |
| 5 | Click Restore | Card reappears in column |

---

## TC-TRANS: Translation Test Cases

### TC-TRANS-001: Auto-Translate on Card Edit
**Priority:** High  
**Preconditions:** Card exists with empty JP field

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open card modal | Modal opens |
| 2 | Edit EN title to "Hello world" | Title updates |
| 3 | Wait 1-2 seconds | JP field auto-fills |
| 4 | Verify translation | Shows "こんにちは世界" or similar |

---

### TC-TRANS-002: Change Primary Language
**Priority:** Medium  
**Preconditions:** Card exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Translation Settings | Settings modal opens |
| 2 | Change primary to Japanese | Setting updates |
| 3 | Create new card with JP text | EN auto-translates |
| 4 | Verify translation direction | Works JP → EN |

---

### TC-TRANS-003: Pokemon Context Mode
**Priority:** Low  
**Preconditions:** Translation settings accessible

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Translation Settings | Modal opens |
| 2 | Select "Pokemon" context | Setting updates |
| 3 | Create card "Pikachu attack" | Translation uses Pokemon terms |
| 4 | Verify JP translation | Contains ピカチュウ |

---

### TC-TRANS-004: Batch Translation
**Priority:** Medium  
**Preconditions:** Board has cards without translations

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open More menu → Batch Translation | Modal opens |
| 2 | Click "Translate All" | Progress bar appears |
| 3 | Wait for completion | All cards show translations |
| 4 | Verify random card | Both EN and JP present |

---

### TC-TRANS-005: Translation Error Retry
**Priority:** Low  
**Preconditions:** Network issues or API error

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create card while API fails | Error indicator shows |
| 2 | Click retry button | Translation attempts again |
| 3 | Verify on success | Translation appears |

---

## TC-OFFLINE: Offline Support Test Cases

### TC-OFFLINE-001: Offline Indicator Displays
**Priority:** High  
**Preconditions:** User is on a board

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disconnect network (DevTools) | Wait 1-2 seconds |
| 2 | Verify indicator | "You're offline" banner appears |
| 3 | Reconnect network | Banner disappears |

---

### TC-OFFLINE-002: Create Card While Offline
**Priority:** High  
**Preconditions:** User is offline

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Add Card | Input appears |
| 2 | Type "Offline card" | Text entered |
| 3 | Press Enter | Card appears locally |
| 4 | Verify pending indicator | Shows pending sync |

---

### TC-OFFLINE-003: Sync on Reconnect
**Priority:** Critical  
**Preconditions:** Pending offline changes exist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Reconnect network | Sync starts automatically |
| 2 | Wait for sync | Pending indicator clears |
| 3 | Refresh page | Data persists from server |

---

### TC-OFFLINE-004: Conflict Resolution
**Priority:** Medium  
**Preconditions:** Same card edited offline and online by different users

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User A edits card offline | Local change saved |
| 2 | User B edits same card online | Server updated |
| 3 | User A reconnects | Conflict detected |
| 4 | Verify resolution | Most recent change wins or merge |

---

## TC-A11Y: Accessibility Test Cases

### TC-A11Y-001: Keyboard Navigation
**Priority:** High  
**Preconditions:** User is on a board

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press `/` | Search input focused |
| 2 | Press `Escape` | Search unfocused |
| 3 | Press Arrow keys | Navigate between cards |
| 4 | Press `Enter` on card | Card modal opens |
| 5 | Press `Escape` | Modal closes |
| 6 | Press `?` | Shortcuts help opens |

---

### TC-A11Y-002: Screen Reader Announcements
**Priority:** Medium  
**Preconditions:** Screen reader enabled (VoiceOver/NVDA)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to card | Card title is announced |
| 2 | Drag card | "Grabbed, press space to drop" |
| 3 | Drop card | "Card moved to [column]" |
| 4 | Open modal | Modal title announced |
| 5 | Create card | "Card created" announcement |

---

### TC-A11Y-003: Focus Management in Modals
**Priority:** High  
**Preconditions:** None

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open card modal | Focus moves to modal |
| 2 | Tab through elements | Focus stays in modal |
| 3 | Shift+Tab at first element | Focus goes to last element |
| 4 | Close modal | Focus returns to trigger |

---

### TC-A11Y-004: Color Contrast
**Priority:** Medium  
**Preconditions:** Color contrast analyzer available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check light theme text | 4.5:1+ contrast ratio |
| 2 | Check dark theme text | 4.5:1+ contrast ratio |
| 3 | Check button labels | 4.5:1+ contrast ratio |
| 4 | Check error messages | 4.5:1+ contrast ratio |

---

### TC-A11Y-005: Skip-to-Content Link
**Priority:** Low  
**Preconditions:** Keyboard user

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab on page load | Skip link appears |
| 2 | Press Enter on skip link | Focus jumps to main content |

---

## Smoke Test Checklist

Quick verification that core functionality works. Run after each deployment.

- [ ] Can sign in with Google
- [ ] Board list displays
- [ ] Can create new board
- [ ] Can navigate to board
- [ ] Can create column
- [ ] Can create card
- [ ] Can open card modal
- [ ] Can edit card
- [ ] Can drag card to another column
- [ ] Can sign out
- [ ] Offline indicator works
- [ ] Search works
- [ ] Theme toggle works

---

## Regression Test Suite

Full regression to run before major releases. Includes all test cases above plus:

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Responsiveness
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Tablet (iPad)

### Performance
- [ ] Page load < 3 seconds
- [ ] Card drag is smooth (60fps)
- [ ] Large board (100+ cards) is usable
- [ ] Memory doesn't leak over time

---

## Bug Report Template

When filing bugs, include:

```
**Summary:** Brief description

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:** What should happen

**Actual Result:** What actually happens

**Environment:**
- Browser: 
- OS: 
- Screen size: 
- Account type: 

**Screenshots/Video:** (attach)

**Severity:** Critical / High / Medium / Low
```
