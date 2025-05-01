const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const client = new S3Client();

exports.handler = async () => {
  const key = `${uuidv4()}.mp3`;
  const command = new PutObjectCommand({
    Bucket: process.env.AUDIO_BUCKET,
    Key: key
  });

  const url = await getSignedUrl(client, command, { expiresIn: 300 });

  return {
    statusCode: 200,
    body: JSON.stringify({ uploadUrl: url, s3Key: key })
  };
};
