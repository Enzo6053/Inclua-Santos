/* Roda antes da página aparecer: dentro do app Android, o app ocupa a tela
   inteira, sem a moldura de celular da versão para computador. */
(function(){
  try{
    if(/IncluaSantosApp/.test(navigator.userAgent)) document.documentElement.classList.add('app-nativo');
  }catch(e){}
})();
