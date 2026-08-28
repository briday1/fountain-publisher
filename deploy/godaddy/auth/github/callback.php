<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

fountain_oauth_session();
$state = (string) ($_GET['state'] ?? '');
$code = (string) ($_GET['code'] ?? '');
$error = (string) ($_GET['error_description'] ?? $_GET['error'] ?? '');
$valid = isset($_SESSION['state'], $_SESSION['verifier'], $_SESSION['created_at'])
    && hash_equals((string) $_SESSION['state'], $state)
    && time() - (int) $_SESSION['created_at'] <= 600;
$verifier = (string) ($_SESSION['verifier'] ?? '');
$_SESSION = [];
session_destroy();

if ($error !== '') {
    fountain_popup_response(null, $error);
}
if (!$valid || $code === '') {
    fountain_popup_response(null, 'The GitHub sign-in request expired or could not be verified.');
}

$config = fountain_oauth_config();
$fields = http_build_query([
    'client_id' => $config['client_id'],
    'client_secret' => $config['client_secret'],
    'code' => $code,
    'redirect_uri' => fountain_oauth_callback_url($config),
    'code_verifier' => $verifier,
]);
$request = curl_init('https://github.com/login/oauth/access_token');
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $fields,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
]);
$body = curl_exec($request);
$status = (int) curl_getinfo($request, CURLINFO_RESPONSE_CODE);
$curlError = curl_error($request);
curl_close($request);

if (!is_string($body) || $status < 200 || $status >= 300) {
    fountain_popup_response(null, $curlError !== '' ? 'GitHub could not be reached.' : 'GitHub rejected the sign-in request.');
}
$result = json_decode($body, true);
$token = is_array($result) ? (string) ($result['access_token'] ?? '') : '';
if ($token === '') {
    fountain_popup_response(null, (string) ($result['error_description'] ?? 'GitHub did not return an access token.'));
}
fountain_popup_response($token, null);
