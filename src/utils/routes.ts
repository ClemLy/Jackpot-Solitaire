// Le jeu tient sur une seule page. Toute autre adresse sous la base du site
// (lien casse, faute de frappe) doit afficher la page 404 du jeu, y compris
// quand le service worker sert index.html a la place de la vraie 404.

/** Vrai si `pathname` designe la page du jeu pour une base donnee. */
export function isAppPath(pathname: string, base: string): boolean {
  const root = base.endsWith('/') ? base : `${base}/`;
  return (
    pathname === root ||
    pathname === `${root}index.html` ||
    `${pathname}/` === root
  );
}
