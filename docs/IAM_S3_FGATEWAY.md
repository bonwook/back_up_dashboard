# S3 버킷 fgateway 접근용 IAM 권한

`AccessDenied: User BWK is not authorized to perform: s3:ListBucket on resource: arn:aws:s3:::fgateway`  
→ IAM 사용자 **BWK**에 아래 권한을 추가하세요.

## 최소 권한 (다운로드만 할 때)

presigned URL로 **다운로드만** 한다면 **GetObject**만 있으면 됩니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::fgateway/*"
    }
  ]
}
```

## ListBucket 에러가 날 때 (파일 목록 등 사용 시)

앱에서 **버킷 목록 조회**(ListBucket)를 쓰는 API가 있으면 아래처럼 **ListBucket**도 허용해야 합니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::fgateway"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::fgateway/*"
    }
  ]
}
```

## 적용 방법

1. AWS 콘솔 → IAM → 사용자 **BWK** 선택
2. **권한 추가** → **정책 연결** 또는 **인라인 정책 생성**
3. 위 JSON을 정책으로 저장

또는 버킷 `fgateway`의 **버킷 정책**에서 BWK에게 `s3:ListBucket`, `s3:GetObject`를 허용해도 됩니다.
