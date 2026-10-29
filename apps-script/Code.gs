function doGet(e) {
  // Récupère le nom du quiz demandé via le paramètre URL ?p=nom_du_fichier
  // (ex : ?p=byzance)
  // Si aucun paramètre n'est spécifié, le script charge le fichier 'Index' par défaut.
  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'Index';

  try {
    return HtmlService.createHtmlOutputFromFile(page)
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    // Si le fichier HTML demandé n'existe pas encore, retour automatique sur 'Index'
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Portail de Révisions')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}
