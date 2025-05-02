const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const transcribe = new TranscribeClient();
const dynamo = new DynamoDBClient();
const s3 = new S3Client();

exports.handler = async (event) => {
  const { userId, s3AudioUrl, classification } = JSON.parse(event.body);
  const jobName = `job-${Date.now()}`;
  const timestamp = new Date().toISOString();

  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: s3AudioUrl },
    MediaFormat: "mp3",
    LanguageCode: "en-US",
    OutputBucketName: process.env.AUDIO_BUCKET
  }));

  let result;
  while (true) {
    const { TranscriptionJob } = await transcribe.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    if (TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
      result = TranscriptionJob.Transcript.TranscriptFileUri;
      break;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const transcript = await fetch(result).then(res => res.json()).then(data => data.results.transcripts[0].transcript);
  const messageId = jobName;

  await dynamo.send(new PutItemCommand({
    TableName: process.env.DYNAMO_TABLE,
    Item: {
      userId: { S: userId },
      timestamp: { S: timestamp },
      messageId: { S: messageId },
      inputType: { S: "audio" },
      originalContent: { S: s3AudioUrl },
      transcription: { S: transcript },
      classification: { S: classification }
    }
  }));

  if (process.env.DELETE_AUDIO_AFTER_TRANSCRIBE === "true") {
    const s3Key = s3AudioUrl.split('/').pop();
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.AUDIO_BUCKET, Key: s3Key }));
  }

  return { statusCode: 200, body: JSON.stringify({ messageId }) };
};
