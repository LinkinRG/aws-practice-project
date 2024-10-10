import { aws_cloudfront, aws_cloudfront_origins, aws_iam, aws_s3, aws_s3_deployment, CfnOutput, RemovalPolicy, Resource } from 'aws-cdk-lib';
import { Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const path = "./resources/build/browser";

export class DeploymentService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const hostingBucket = new aws_s3.Bucket(this, 'FrontendBucket', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
    });

    const bucketPolicy = new aws_s3.CfnBucketPolicy(this, 'FrontendBucketPolicy', {
      bucket: hostingBucket.bucketName,
      policyDocument: {
        Statement: [
          {
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: {
              Service: 'cloudfront.amazonaws.com',
            },
            Resource: [
              hostingBucket.bucketArn,
              `${hostingBucket.bucketArn}/*`
            ]
          }
        ],
        Version: '2012-10-17',
      }
    });

    hostingBucket.addToResourcePolicy(new aws_iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [hostingBucket.bucketArn, hostingBucket.arnForObjects('*')],
      principals: [new aws_iam.ServicePrincipal('cloudfront.amazonaws.com')]
    }))

    const originAccessControl = new aws_cloudfront.S3OriginAccessControl(this, 'FrontendOAC');

    const s3Origin = aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(hostingBucket, {
      originAccessControl: originAccessControl
    });


    const distribution = new aws_cloudfront.Distribution(
        this,
        'CloudfrontDistribution',
        {
            defaultBehavior: {
              origin: s3Origin,
              viewerProtocolPolicy:
                aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: "index.html",
            errorResponses: [
              {
                httpStatus: 404,
                responseHttpStatus: 200,
                responsePagePath: "/index.html",
              },
            ],
          }
    );

    new aws_s3_deployment.BucketDeployment(this, "BucketDeployment", {
        sources: [aws_s3_deployment.Source.asset(path)],
        destinationBucket: hostingBucket,
        distribution,
        distributionPaths: ["/*"],
      });

      new CfnOutput(this, "CloudFrontURL", {
        value: distribution.domainName,
        description: "The distribution URL",
        exportName: "CloudfrontURL",
      });
  
      new CfnOutput(this, "BucketName", {
        value: hostingBucket.bucketName,
        description: "The name of the S3 bucket",
        exportName: "BucketName",
      });
  }
}