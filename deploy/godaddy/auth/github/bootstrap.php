<?php
declare(strict_types=1);

function fountain_oauth_config(): array
{
    $config = [
        'client_id' => getenv('FOUNTAIN_GITHUB_CLIENT_ID') ?: '',
        'client_secret' => getenv('FOUNTAIN_GITHUB_CLIENT_SECRET') ?: '',
        'callback_url' => getenv('FOUNTAIN_GITHUB_CALLBACK_URL') ?: '',
    ];
    $configFile = dirname((string) $_SERVER['DOCUMENT_ROOT']) . '/fountain-publisher-oauth.php';
    if (is_file($configFile)) {
        $fileConfig = require $configFile;
        if (is_array($fileConfig)) {
            $config = array_merge($config, $fileConfig);
        }
    }
    return $config;
}

function fountain_oauth_session(): void
{
    session_name('fountain_github_oauth');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/auth/github/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function fountain_oauth_callback_url(array $config): string
{
    if ($config['callback_url'] !== '') {
        return $config['callback_url'];
    }
    return 'https://' . $_SERVER['HTTP_HOST'] . '/auth/github/callback.php';
}

function fountain_base64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function fountain_popup_response(?string $token, ?string $error): never
{
    $nonce = fountain_base64url(random_bytes(18));
    header("Content-Security-Policy: default-src 'none'; script-src 'nonce-{$nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    header('Cache-Control: no-store');
    $payload = json_encode([
        'type' => 'fountain-publisher:github-oauth',
        'token' => $token,
        'error' => $error,
    ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    echo "<!doctype html><meta charset=\"utf-8\"><title>GitHub sign in</title>";
    echo "<p>" . ($error ? "GitHub sign in failed. You may close this window." : "Signed in. This window will close.") . "</p>";
    echo "<script nonce=\"{$nonce}\">";
    echo "if(window.opener){window.opener.postMessage({$payload},location.origin);}window.close();";
    echo "</script>";
    exit;
}
