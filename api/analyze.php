<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

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
$imageWidth = $input['imageWidth'] ?? 0;
$imageHeight = $input['imageHeight'] ?? 0;

// Parse base64 image - use string functions instead of regex (faster, no backtrack limit)
$commaPos = strpos($image, ',');
if ($commaPos === false || strpos($image, 'data:image/') !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid image data']);
    exit;
}

$header = substr($image, 5, $commaPos - 5); // e.g. "image/jpeg;base64"
$mediaType = explode(';', $header)[0];
$base64Data = substr($image, $commaPos + 1);

// Build profile summary
$profileLines = [];
foreach ($profile as $key => $value) {
    if ($key === '_custom') continue;
    $profileLines[] = "$key: $value";
}
$profileSummary = implode("\n", $profileLines);

$prompt = "You are an expert form-filling assistant. Analyze this form image and tell me where to place text.

CRITICAL: The image is {$imageWidth}px wide and {$imageHeight}px tall. You MUST return coordinates as PERCENTAGES (0 to 100), NOT pixels. For example, if something is 120px from the left in a 1200px wide image, x = 10.0 (because 120/1200 * 100 = 10.0).

User's data:
$profileSummary

For each form field that matches the user's data, return the PRECISE position WHERE TO WRITE the value.

POSITIONING — THIS IS THE MOST IMPORTANT PART:
- Place text RIGHT NEXT TO the label it belongs to — just a tiny gap after the last letter of the label or colon
- If the form says \"Name: ___________\", your x should be RIGHT AFTER the colon, where the blank starts
- If the form says \"Name\" with a line below it, place text at the START of that line, vertically on the line
- The y coordinate should align the filled text on the SAME BASELINE as the label text, not above or below
- Think of it like handwriting: you'd start writing immediately after the printed label

COORDINATE RULES (all values are percentages 0-100):
- x: percentage from left edge to where the fill-in area begins (right after the label text ends)
- y: percentage from top edge, aligned with the label's text baseline
- width: percentage width of the writing area
- height: percentage height of the writing area
- fontSize: percentage of image height for text size — match the size of the printed label text on the form (typically 1.0 to 2.5)

EXAMPLE: If \"Name:\" ends at about 15% from the left and the line goes to 75%, and it's 20% down:
{\"label\": \"Name\", \"x\": 16.0, \"y\": 20.0, \"width\": 59.0, \"height\": 2.5, \"value\": \"John Smith\", \"fontSize\": 1.5}
Notice x=16.0 is right after \"Name:\" ends at 15%.

IMPORTANT CHECKS:
- Every x and y value must be between 0 and 100
- If you find yourself writing a value like 241 — STOP — that's pixels, not a percentage. Divide by image dimensions ({$imageWidth} x {$imageHeight}) and multiply by 100.
- Double-check that your x puts text at the START of the blank area, not on top of the label

Return ONLY this JSON, nothing else:
{\"fields\": [{\"label\": \"...\", \"x\": 0-100, \"y\": 0-100, \"width\": 0-100, \"height\": 0-100, \"value\": \"...\", \"fontSize\": 1.0-3.0}]}";

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

// Extract JSON from response using string search (more reliable than regex)
$firstBrace = strpos($text, '{');
$lastBrace = strrpos($text, '}');

if ($firstBrace !== false && $lastBrace !== false) {
    $jsonStr = substr($text, $firstBrace, $lastBrace - $firstBrace + 1);
    $result = json_decode($jsonStr, true);
    if ($result && isset($result['fields'])) {
        // Normalize coordinates — if any x or y > 100, AI returned pixel coords not percentages
        // Detect by checking if any coordinate exceeds 100
        $needsNormalize = false;
        foreach ($result['fields'] as $field) {
            if (($field['x'] ?? 0) > 100 || ($field['y'] ?? 0) > 100 ||
                ($field['width'] ?? 0) > 100 || ($field['height'] ?? 0) > 100) {
                $needsNormalize = true;
                break;
            }
        }
        if ($needsNormalize && $imageWidth > 0 && $imageHeight > 0) {
            // Use actual image dimensions sent from frontend
            foreach ($result['fields'] as &$field) {
                $field['x'] = ($field['x'] / $imageWidth) * 100;
                $field['y'] = ($field['y'] / $imageHeight) * 100;
                $field['width'] = ($field['width'] / $imageWidth) * 100;
                $field['height'] = ($field['height'] / $imageHeight) * 100;
                if (isset($field['fontSize']) && $field['fontSize'] > 5) {
                    // fontSize was also in pixels, convert to % of height
                    $field['fontSize'] = ($field['fontSize'] / $imageHeight) * 100;
                }
            }
            unset($field);
        } elseif ($needsNormalize) {
            // Fallback: estimate dimensions from max coordinates
            $maxX = 0; $maxY = 0;
            foreach ($result['fields'] as $field) {
                $right = ($field['x'] ?? 0) + ($field['width'] ?? 0);
                $bottom = ($field['y'] ?? 0) + ($field['height'] ?? 0);
                if ($right > $maxX) $maxX = $right;
                if ($bottom > $maxY) $maxY = $bottom;
            }
            $imgW = max($maxX * 1.1, 800);
            $imgH = max($maxY * 1.1, 1000);
            foreach ($result['fields'] as &$field) {
                $field['x'] = ($field['x'] / $imgW) * 100;
                $field['y'] = ($field['y'] / $imgH) * 100;
                $field['width'] = ($field['width'] / $imgW) * 100;
                $field['height'] = ($field['height'] / $imgH) * 100;
            }
            unset($field);
        }
        echo json_encode($result);
    } elseif ($result) {
        echo json_encode($result);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse AI response', 'raw' => substr($text, 0, 500)]);
    }
} else {
    http_response_code(500);
    echo json_encode(['error' => 'No valid JSON in AI response', 'raw' => substr($text, 0, 500)]);
}
