# brassplates.com

Static GitHub Pages site for scripture connections between Book of Mormon readings and
Come, Follow Me passages.

The homepage shows one day at a time, defaults to the current date, supports previous/next
day navigation, keeps the selected date in the URL for bookmarking, and includes a date
picker plus inline scripture frames.

Append `#admin` to the URL to open the in-browser admin tools. Admin mode uses
`#admin/YYYYMMDD`, lets you edit the currently selected date, merge pasted JSON that replaces
same-date entries, and submit the updated `cfm.json` through a GitHub pull request.

## Admin publishing

Admin mode requires a GitHub personal access token with read/write Contents and Pull requests
permissions for this repository. The token is stored in the browser's local storage and is used
only to create or update the editor's `entries/<GitHub username>` branch and its pull request to
`main`. Before publishing, the editor shows the exact added, updated, and removed entry JSON for
confirmation. Remove the token with the **Clear saved token** button when using a shared device.

Users listed in `DIRECT_PUSH_USERS` in `script.js` save directly to `main`; `jfunk42` is the
initial approved publisher. Add GitHub usernames to this list to approve additional direct
publishers (matching is case-insensitive). Everyone else continues to use a pull request.

## Content updates

Add or edit entries in `data/cfm.json`. Each entry should include:

- `date`
- `book_of_mormon_reference`
- `book_of_mormon_reference_url`
- `come_follow_me_reference`
- `come_follow_me_reference_url`
- `connecting_thought_text`
- Optional `youtube_clips` and `files` arrays. Each item requires `url` and `description`, and
  can include a numeric `order` (lower values appear first; unordered items follow ordered ones).
  YouTube clips must use a YouTube video URL and render as paused embedded previews.
  Files can use an existing URL or be uploaded through admin mode. Uploads are stored in
  `data/files/`, limited to 1 MB, and overwrite an existing file with the same name.

## Publish

1. Push this folder to the `brassplates.com` repository on GitHub.
2. Enable GitHub Pages with the included Actions workflow.
3. Point the `brassplates.com` domain at GitHub Pages when ready.
