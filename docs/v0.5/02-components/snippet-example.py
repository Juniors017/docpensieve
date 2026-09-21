"""A second file, in another language, so the page can show what changes.

Nothing here is read by the tool: it is only the source of an example. The
extension is what tells the block which language it holds, and therefore
which mark and which colour it carries.
"""

SKIPPED = {"a", "an", "the", "of", "to"}


def slug_of(title: str) -> str:
    """Turn the title of a page into the last segment of its address."""
    # #region guard
    if not isinstance(title, str) or not title.strip():
        raise TypeError("slug_of needs a title")
    # #endregion

    words = "".join(c if c.isalnum() else " " for c in title.lower()).split()
    return "-".join(w for w in words if w not in SKIPPED)
