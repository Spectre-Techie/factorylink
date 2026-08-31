$ErrorActionPreference = 'Stop'
$orgId = [Guid]::NewGuid().ToString()
$creatorId = [Guid]::NewGuid().ToString()
$assigneeId = [Guid]::NewGuid().ToString()
$contactName = 'Phase4-Live-Contact-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
$contactPhone = '+254712345678'
$workTitle = 'Phase4-Live-WorkOrder-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')

Write-Host "ORG_ID=$orgId"
Write-Host "CREATOR_ID=$creatorId"
Write-Host "ASSIGNEE_ID=$assigneeId"

Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing | Select-Object -ExpandProperty Content

$contactResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/contacts' -ContentType 'application/json' -Body (@{
    organization_id = $orgId
    name = $contactName
    phone_number = $contactPhone
    channel = 'sms'
    status = 'active'
} | ConvertTo-Json -Compress)
Write-Host 'CONTACT=' ($contactResp | ConvertTo-Json -Depth 8 -Compress)

$workResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/work-orders' -ContentType 'application/json' -Body (@{
    organization_id = $orgId
    title = $workTitle
    description = 'Runtime route verification'
    priority = 'high'
    created_by_user_id = $creatorId
} | ConvertTo-Json -Compress)
Write-Host 'CREATE=' ($workResp | ConvertTo-Json -Depth 8 -Compress)

$woId = $workResp.data.id
$retrieved = Invoke-RestMethod -Uri "http://localhost:4000/api/work-orders/$woId"
Write-Host 'GET=' ($retrieved | ConvertTo-Json -Depth 8 -Compress)

$listed = Invoke-RestMethod -Uri 'http://localhost:4000/api/work-orders'
$listMatches = @($listed.data | Where-Object { $_.id -eq $woId })
Write-Host 'LIST_HAS_WORKORDER=' ($listMatches.Count -gt 0)
Write-Host 'LIST_MATCH_COUNT=' $listMatches.Count

$assignResp = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/work-orders/$woId/assign" -ContentType 'application/json' -Body (@{
    assignee_id = $assigneeId
    assignee_phone_number = '+254700000001'
} | ConvertTo-Json -Compress)
Write-Host 'ASSIGN=' ($assignResp | ConvertTo-Json -Depth 8 -Compress)

$statusTransition1 = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/work-orders/$woId/status" -ContentType 'application/json' -Body (@{
    status = 'in_progress'
} | ConvertTo-Json -Compress)
Write-Host 'STATUS_IN_PROGRESS=' ($statusTransition1 | ConvertTo-Json -Depth 8 -Compress)

$statusTransition2 = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/work-orders/$woId/status" -ContentType 'application/json' -Body (@{
    status = 'completed'
} | ConvertTo-Json -Compress)
Write-Host 'STATUS_COMPLETED=' ($statusTransition2 | ConvertTo-Json -Depth 8 -Compress)

try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/work-orders/$woId/status" -ContentType 'application/json' -Body (@{
        status = 'assigned'
    } | ConvertTo-Json -Compress) | Out-Null
    Write-Host 'INVALID_TRANSITION=UNEXPECTED_SUCCESS'
}
catch {
    Write-Host 'INVALID_TRANSITION_REJECTED'
}

$env:WO_ID = $woId
node -r dotenv/config -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}}); (async()=>{ const { data: row, error } = await supabase.from('work_orders').select('*').eq('id', process.env.WO_ID).maybeSingle(); const { data: events, error: evtErr } = await supabase.from('work_order_events').select('*').eq('work_order_id', process.env.WO_ID).order('created_at',{ascending:true}); console.log('DB_WORK_ORDER=' + JSON.stringify(row)); console.log('DB_EVENTS=' + JSON.stringify(events)); if (error) console.log('DB_WORK_ORDER_ERR=' + error.message); if (evtErr) console.log('DB_EVENTS_ERR=' + evtErr.message); })().catch((err)=>{ console.error(err.message); process.exit(1); });"
