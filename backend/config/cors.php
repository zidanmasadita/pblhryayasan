<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
    ],

    'allowed_methods' => ['*'],

    /*
     * PENTING:
     * - Karena pakai withCredentials = true
     * - TIDAK BOLEH pakai '*'
     */
    'allowed_origins' => [
        'https://pblhryayasandarussalam-ewwu.vercel.app',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    /*
     * Tidak perlu expose header khusus
     */
    'exposed_headers' => [],

    'max_age' => 0,

    /*
     * WAJIB true untuk Sanctum + cookie cross-domain
     */
    'supports_credentials' => true,
];
