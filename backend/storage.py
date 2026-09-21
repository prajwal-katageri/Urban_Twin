import os

def storage_is_configured():
    return all([
        os.getenv('AWS_ENDPOINT_URL_S3'),
        os.getenv('AWS_ACCESS_KEY_ID'),
        os.getenv('AWS_SECRET_ACCESS_KEY'),
        os.getenv('AWS_S3_BUCKET'),
    ])


def get_storage_client():
    if not storage_is_configured():
        raise RuntimeError('S3 storage environment variables are not configured')
    try:
        import boto3
        from botocore.config import Config
    except ImportError as error:
        raise RuntimeError('Install boto3 to enable S3-compatible storage') from error
    return boto3.client(
        's3',
        endpoint_url=os.environ['AWS_ENDPOINT_URL_S3'],
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        region_name=os.getenv('AWS_REGION', 'ap-southeast-1'),
        config=Config(signature_version='s3v4'),
    )
