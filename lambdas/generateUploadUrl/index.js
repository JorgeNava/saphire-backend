const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl }              = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 }                = require('uuid');

const s3 = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async () => {
  const key = `${uuidv4()}.mp3`;
  const cmd = new PutObjectCommand({
    Bucket:      process.env.AUDIO_BUCKET,
    Key:         key,
    ContentType: 'audio/mpeg'
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

  return {
    statusCode: 200,
    body: JSON.stringify({
      uploadUrl,
      s3Key: key
    })
  };
};
