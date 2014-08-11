# Write-Realtime

Basic demo using contenteditable fields in meteorjs with collaborative editing, tab navigation, paragraph reordering, selection retention on field change and basic documents.

Demo at http://writerealtime.meteor.com

## Known Issues
- First attempt to save first fragment for a document fails, then should work as expected (diff-update related maybe?).

## TODO
- Add user model and remove insecure and autopublish
- Article metadata (including name)
- Maybe sync per keypress changes
- Maybe sync selection ranges