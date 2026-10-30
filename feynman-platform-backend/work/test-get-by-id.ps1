$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'

Write-Output '=== 1) 用你自己的账号 123@123 登录 ==='
try {
    $login = (Invoke-WebRequest "$base/api/users/login" -Method POST -ContentType 'application/json' -Body '{"email":"123@123","password":"123456"}' -UseBasicParsing).Content | ConvertFrom-Json
} catch {
    Write-Output "登录失败: HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)"
    exit 1
}
$token = $login.token
Write-Output "登录成功，token 长度 $($token.Length)"
$h = @{ Authorization = "Bearer $token" }

Write-Output ''
Write-Output '=== 2) GET /api/knowledge-points (读全部) ==='
$list = @(((Invoke-WebRequest "$base/api/knowledge-points" -Headers $h -UseBasicParsing).Content | ConvertFrom-Json))
Write-Output "共 $($list.Count) 条:"
foreach ($item in $list) {
    Write-Output ("   _id=" + $item.'_id' + "  title=" + $item.title + "  createdAt=" + $item.createdAt)
}

if ($list.Count -eq 0) { Write-Output '没有数据，跳过后续测试'; exit 0 }
$id = $list[0].'_id'

Write-Output ''
Write-Output "=== 3) GET /api/knowledge-points/$id (读单个，你刚补的接口) ==="
try {
    $one = (Invoke-WebRequest "$base/api/knowledge-points/$id" -Headers $h -UseBasicParsing -TimeoutSec 20).Content | ConvertFrom-Json
    Write-Output "HTTP 200 OK -> title=$($one.title)  status=$($one.status)  reviewList=$($one.reviewList)"
    Write-Output "             _id=$($one.'_id')"
} catch { Write-Output "失败: HTTP $($_.Exception.Response.StatusCode.value__)" }

Write-Output ''
Write-Output '=== 4) GET 一个不存在的合法 id (预期 404) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/000000000000000000000000" -Headers $h -UseBasicParsing -TimeoutSec 20 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)" }

Write-Output ''
Write-Output '=== 5) GET 非法 id /abc (预期 500，被 catch 兜住) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/abc" -Headers $h -UseBasicParsing -TimeoutSec 20 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__)" }

Write-Output ''
Write-Output '=== 6) GET 单个但不带 token (预期 401) ==='
try { Invoke-WebRequest "$base/api/knowledge-points/$id" -UseBasicParsing -TimeoutSec 20 | Out-Null }
catch { Write-Output "HTTP $($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)" }
