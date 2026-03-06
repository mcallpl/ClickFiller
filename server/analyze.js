import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function analyzeForm(imageDataUrl, profile) {
  const base64Match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid image data');
  }

  const mediaType = base64Match[1];
  const base64Data = base64Match[2];

  const profileSummary = Object.entries(profile)
    .filter(([key]) => key !== '_custom')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `You are an expert form-filling assistant. Look at this form image very carefully.

STEP 1: Study the form's layout. Note where each label is and where the corresponding blank/line/box is where someone would write. Pay attention to the SIZE of the printed text on the form — your filled text should match that size.

STEP 2: Match fields to the user's data below.

User's data:
${profileSummary}

STEP 3: For each matchable field, return PRECISE coordinates of WHERE TO WRITE the value.

COORDINATE SYSTEM:
- All values are percentages of the image dimensions (0-100)
- x = distance from LEFT edge to where text should START writing
- y = distance from TOP edge to the TOP of the writing area
- width = how wide the writing area is
- height = how tall the writing area is

POSITIONING RULES:
- Look at where the blank line, underline, or empty box is — that's where x,y should point
- If label says "Name:" followed by a line, x should be at the START of that line, NOT at the "N" in "Name"
- If there are boxes/cells in a table, position inside the cell
- y should put text directly ON the baseline/line, not floating above it
- Measure carefully — even small % errors will be very visible

FONT SIZE:
- Look at the existing printed text on the form (the labels like "Name", "Address", etc.)
- Your fontSize should match that printed text size
- Estimate fontSize as a percentage of image height (e.g., if labels are about 1.5% of image height tall, use fontSize: 1.5)
- This is critical — text that's too small or too big looks wrong

Return JSON:
{"fields": [{"label": "Field Name", "x": 25.5, "y": 12.3, "width": 28.0, "height": 2.8, "value": "John", "fontSize": 1.5}]}

- fontSize is a percentage of image height
- Only include fields with matching user data
- Return ONLY valid JSON, nothing else`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  return JSON.parse(jsonMatch[0]);
}
