#!/bin/bash
awslocal s3 mb s3://raw-videos
awslocal s3 mb s3://hls-segments
awslocal s3api put-bucket-cors --bucket hls-segments --cors-configuration '{
  "CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"]}]
}'
awslocal sqs create-queue --queue-name transcode-jobs
echo "LocalStack buckets ready"
