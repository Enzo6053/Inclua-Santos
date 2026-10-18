plugins {
    id("com.android.application")
}

// A chave de upload vem das variáveis de ambiente (segredos do GitHub Actions).
// Sem elas, o build de release sai sem assinatura.
val chaveArquivo: String? = System.getenv("ANDROID_KEYSTORE_PATH")

android {
    namespace = "br.com.incluasantos.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.incluasantos.app"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"
        buildConfigField("String", "SITE_URL", "\"https://enzo6053.github.io/Inclua-Santos/\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (chaveArquivo != null) {
            create("upload") {
                storeFile = file(chaveArquivo)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (chaveArquivo != null) {
                signingConfig = signingConfigs.getByName("upload")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
