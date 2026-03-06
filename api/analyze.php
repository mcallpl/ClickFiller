<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['image']) || empty($input['profile'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing image or profile data']);
    exit;
}

$image = $input['image'];
$profile = $input['profile'];

// Parse base64 image
if (!preg_match('/^data:(image\/\w+);base64,(.+)$/', $image, $matches)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid image data']);
    exit;
}

$mediaType = $matches[1];
$base64Data = $matches[2];

// Build profile summary
$profileLines = [];
foreach ($profile as $key => $value) {
    if ($key === '_custom') continue;
    $profileLines[] = "$key: $value";
}
$profileSummary = implode("\n", $profileLines);

$prompt = "You are an expert form-filling assistant. Look at this form image very carefully.

STEP 1: Study the form's layout. Note where each label is and where the corresponding blank/line/box is where someone would write. Pay attention to the SIZE of the printed text on the form — your filled text should match that size.

STEP 2: Match fields to the user's data below.

User's data:
$profileSummary

STEP 3: For each matchable field, return PRECISE coordinates of WHERE TO WRITE the value.

COORDINATE SYSTEM:
- All values are percentages of the image dimensions (0-100)
- x = distance from LEFT edge to where text should START writing
- y = distance from TOP edge to the TOP of the writing area
- width = how wide the writing area is
- height = how tall the writing area is

POSITIONING RULES:
- Look at where the blank line, underline, or empty box is — that's where x,y should point
- If label says \"Name:\" followed by a line, x should be at the START of that line, NOT at the \"N\" in \"Name\"
- If there are boxes/cells in a table, position inside the cell
- y should put text directly ON the baseline/line, not floating above it
- Measure carefully — even small % errors will be very visible

FONT SIZE:
- Look at the existing printed text on the form (the labels like \"Name\", \"Address\", etc.)
- Your fontSize should match that printed text size
- Estimate fontSize as a percentage of image height (e.g., if labels are about 1.5% of image height tall, use fontSize: 1.5)
- This is critical — text that's too small or too big looks wrong

Return JSON:
{\"fields\": [{\"label\": \"Field Name\", \"x\": 25.5, \"y\": 12.3, \"width\": 28.0, \"height\": 2.8, \"value\": \"John\", \"fontSize\": 1.5}]}

- fontSize is a percentage of image height
- Only include fields where you have matching profile data
- Return ONLY valid JSON, nothing else";

$requestBody = [
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 4096,
    'messages' => [
        [
            'role' => 'user',
            'content' => [
                [
                    'type' => 'image',
                    'source' => [
                        'type' => 'base64',
                        'media_type' => $mediaType,
                        'data' => $base64Data,
                    ],
                ],
                [
                    'type' => 'text',
                    'text' => $prompt,
                ],
            ],
        ],
    ],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . $ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS => json_encode($requestBody),
    CURLOPT_TIMEOUT => 120,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'API request failed: ' . $curlError]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo $response;
    exit;
}

$data = json_decode($response, true);
$text = $data['content'][0]['text'] ?? '';

// Extract JSON from response
if (preg_match('/\{[\s\S]*\}/', $text, $jsonMatch)) {
    $result = json_decode($jsonMatch[0], true);
    if ($result) {
        echo json_encode($result);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse AI response']);
    }
} else {
    http_response_code(500);
    echo json_encode(['error' => 'No valid JSON in AI response']);
}
