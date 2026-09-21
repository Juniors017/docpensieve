"""Un second fichier, dans un autre langage, pour que la page montre ce qui change.

Rien ici n'est lu par l'outil : c'est seulement la source d'un exemple.
L'extension est ce qui dit au bloc quel langage il contient, et donc quelle
marque et quelle couleur il porte.
"""

SKIPPED = {"le", "la", "les", "de", "des", "du"}


def slug_of(title: str) -> str:
    """Transforme le titre d'une page en dernier segment de son adresse."""
    # #region guard
    if not isinstance(title, str) or not title.strip():
        raise TypeError("slug_of needs a title")
    # #endregion

    words = "".join(c if c.isalnum() else " " for c in title.lower()).split()
    return "-".join(w for w in words if w not in SKIPPED)
