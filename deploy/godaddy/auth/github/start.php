<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$config = fountain_oauth_config();
if ($config['client_id'] === '' || $config['client_secret'] === '') {
    fountain_popup_response(null, 'GitHub sign in is not configured on this server. Use an access token instead.');
}

fountain_oauth_session();
$state = fountain_base64url(random_bytes(32));
$verifier = fountain_base64url(random_bytes(64));
$_SESSION['state'] = $state;
$_SESSION['verifier'] = $verifier;
$_SESSION['created_at'] = time();

$query = http_build_query([
    'client_id' => $config['client_id'],
    'redirect_uri' => fountain_oauth_callback_url($config),
    'scope' => 'repo',
    'state' => $state,
    'code_challenge' => fountain_base64url(hash('sha256', $verifier, true)),
    'code_challenge_method' => 'S256',
]);
header('Cache-Control: no-store');
header('Location: https://github.com/login/oauth/authorize?' . $query, true, 302);
exit;
