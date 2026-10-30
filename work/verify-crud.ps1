$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'
$email = "verify$(Get-Random)@test.com"

Write-Output '=== 0) 注册一个全新账号 ==='
$regBody = "{`"username`":`"verifyuser`",`"email`":`"$email`",`"password`":`"123456`"}"
try {
    $reg = (Invoke-WebRequest "$base/api/users/register" -Method POST -ContentType 'application/json' -Body $regBody -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json
} catch {
    Write-Output "注册失败: HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)"
    exit 1
}
Write-Output "注册成功，直接拿到 token 长度 $($reg.token.Length)   (说明数据库读写都正常)"
$token = $reg.token
$h = @{ Authorization = "Bearer $token" }

Write-Output ''
Write-Output '=== 1) 先写一条知识点 (POST) ==='
$kp = "{`"title`":`"GET/:id 验证`",`"content`":`"# 测试内容`"}"
$created = (Invoke-WebRequest "$base/api/knowledge-points" -Method POST -Headers $h -ContentType 'application/json' -Body $kp -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json
$id = $created.'_id'
Write-Output "HTTP 200 OK -> _id=$id"

Write-Output ''
Write-Output '=== 2) 读全部 (GET /) ==='
$list = @(((Invoke-WebRequest "$base/api/knowledge-points" -Headers $h -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json))
Write-Output "共 $($list.Count) 条（该新账号只有自己这条）"

Write-Output ''
Write-Output "=== 3) 读单个 (GET /:id) —— 你刚补的接口 ==="
try {
    $one = (Invoke-WebRequest "$base/api/knowledge-points/$id" -Headers $h -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json
    Write-Output "HTTP 200 OK，返回单个对象:"
    Write-Output "   _id=$($one.'_id')"
    Write-Output "   title=$($one.title)"
    Write-Output "   user=$($one.user)"
    Write-Output "   status=$($one.status)  reviewList=$($one.reviewList)"
} catch { Write-Output "失败: HTTP $($_.Exception.Response.StatusCode.value__)" }

Write-Output ''
Write-Output '=== 4) 读一个不存在的合法 id (预期 404) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/000000000000000000000000" -Headers $h -UseBasicParsing -TimeoutSec 25 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)" }

Write-Output ''
Write-Output '=== 5) 读非法 id /abc (预期 500，被 catch 兜住) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/abc" -Headers $h -UseBasicParsing -TimeoutSec 25 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__)" }

Write-Output ''
Write-Output '=== 6) 读单个但不带 token (预期 401) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/$id" -UseBasicParsing -TimeoutSec 25 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)" }

Write-Output ''
Write-Output '=== 7) 清理：删掉这条测试数据 (DELETE) ==='
$del = (Invoke-WebRequest "$base/api/knowledge-points/$id" -Method DELETE -Headers $h -UseBasicParsing -TimeoutSec 25).Content
Write-Output "HTTP 200 -> $del"
$after = @(((Invoke-WebRequest "$base/api/knowledge-points" -Headers $h -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json))
Write-Output "删除后该账号列表数量 = $($after.Count)"
