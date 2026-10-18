package br.com.incluasantos.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.Toast;

/**
 * Abre o site do Inclua Santos em tela cheia. Páginas do próprio site abrem
 * aqui dentro; links de fora, telefone e e-mail abrem nos apps do aparelho.
 */
public class MainActivity extends Activity {

    private static final Uri SITE = Uri.parse(BuildConfig.SITE_URL);

    private WebView web;
    private View semConexao;
    private boolean erroNaPagina = false;
    private OnBackInvokedCallback voltar;
    private boolean voltarRegistrado = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        semConexao = findViewById(R.id.sem_conexao);
        findViewById(R.id.tentar_de_novo).setOnClickListener(v -> tentarDeNovo());
        aplicarTelaCheia(findViewById(R.id.raiz));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        // o site reconhece o app por aqui e ocupa a tela inteira
        s.setUserAgentString(s.getUserAgentString() + " IncluaSantosApp/" + BuildConfig.VERSION_NAME);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new Cliente());

        if (Build.VERSION.SDK_INT >= 33) {
            voltar = () -> {
                if (web != null && web.canGoBack()) web.goBack();
            };
        }

        if (estado == null || web.restoreState(estado) == null) {
            web.loadUrl(SITE.toString());
        }
    }

    /** No Android 11 em diante, o app desenha atrás das barras e se afasta delas e do teclado. */
    private void aplicarTelaCheia(View raiz) {
        if (Build.VERSION.SDK_INT < 30) return;
        getWindow().setDecorFitsSystemWindows(false);
        raiz.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets barras = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            Insets teclado = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(barras.left, barras.top, barras.right, Math.max(barras.bottom, teclado.bottom));
            return WindowInsets.CONSUMED;
        });
    }

    private static boolean doSite(Uri uri) {
        String host = uri.getHost();
        String caminho = uri.getPath();
        return "https".equalsIgnoreCase(uri.getScheme())
                && host != null && host.equalsIgnoreCase(SITE.getHost())
                && caminho != null && caminho.startsWith(SITE.getPath());
    }

    private void abrirFora(Uri uri) {
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        switch (esquema) {
            case "http":
            case "https":
            case "tel":
            case "mailto":
            case "sms":
            case "geo":
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(this, R.string.nao_abriu, Toast.LENGTH_LONG).show();
                }
                break;
            default:
                Toast.makeText(this, R.string.nao_abriu, Toast.LENGTH_LONG).show();
        }
    }

    private void mostrarSemConexao(boolean mostrar) {
        semConexao.setVisibility(mostrar ? View.VISIBLE : View.GONE);
        if (web != null) web.setVisibility(mostrar ? View.INVISIBLE : View.VISIBLE);
    }

    private void tentarDeNovo() {
        if (web == null) return;
        erroNaPagina = false;
        String atual = web.getUrl();
        if (atual == null || atual.isEmpty()) web.loadUrl(SITE.toString());
        else web.reload();
    }

    /** O voltar do celular anda pelo histórico do site; na tela inicial, fecha o app. */
    private void atualizarVoltar() {
        if (Build.VERSION.SDK_INT < 33 || voltar == null) return;
        boolean pode = web != null && web.canGoBack();
        OnBackInvokedDispatcher d = getOnBackInvokedDispatcher();
        if (pode && !voltarRegistrado) {
            d.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, voltar);
            voltarRegistrado = true;
        } else if (!pode && voltarRegistrado) {
            d.unregisterOnBackInvokedCallback(voltar);
            voltarRegistrado = false;
        }
    }

    /** Android 12 e anteriores. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        if (web != null) web.saveState(estado);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        descartarWeb();
        super.onDestroy();
    }

    private void descartarWeb() {
        if (web == null) return;
        ViewGroup pai = (ViewGroup) web.getParent();
        if (pai != null) pai.removeView(web);
        web.destroy();
        web = null;
    }

    private class Cliente extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
            Uri uri = pedido.getUrl();
            if (doSite(uri)) return false;
            abrirFora(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView v, String url, Bitmap icone) {
            erroNaPagina = false;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            if (!erroNaPagina) mostrarSemConexao(false);
            atualizarVoltar();
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest pedido, WebResourceError erro) {
            if (pedido.isForMainFrame()) {
                erroNaPagina = true;
                mostrarSemConexao(true);
            }
        }

        @Override
        public void doUpdateVisitedHistory(WebView v, String url, boolean recarregou) {
            atualizarVoltar();
        }

        /** Se o motor do navegador cair, recria a tela em vez de fechar o app. */
        @Override
        public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detalhe) {
            if (v == web) {
                descartarWeb();
                recreate();
            }
            return true;
        }
    }
}
