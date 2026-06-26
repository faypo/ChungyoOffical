# import.ps1 - Import backend JSON data into MySQL
# Usage: cd database; .\import.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$EnvFile   = "$PSScriptRoot\..\docker\.env"
$DataDir   = "$PSScriptRoot\..\backend\data"
$Container = "chungyo_mysql"

# Read .env
$env_vars = @{}
Get-Content $EnvFile | Where-Object { $_ -match "^\s*[^#]" } | ForEach-Object {
  $parts = $_ -split "=", 2
  if ($parts.Count -eq 2) { $env_vars[$parts[0].Trim()] = $parts[1].Trim() }
}
$DB_USER = $env_vars["MYSQL_USER"]
$DB_PASS = $env_vars["MYSQL_PASSWORD"]
$DB_NAME = $env_vars["MYSQL_DATABASE"]

function Exec-SQL($sql) {
  $result = $sql | docker exec -i $Container mysql --default-character-set=utf8mb4 -u $DB_USER -p"$DB_PASS" $DB_NAME 2>&1
  if ($LASTEXITCODE -ne 0) { throw $result }
}

function Esc($val) {
  if ($null -eq $val -or "$val" -eq "") { return "NULL" }
  $s = "$val".Replace("\", "\\").Replace("'", "''")
  return "'" + $s + "'"
}

function ToDate($val) {
  if ($null -eq $val -or "$val" -eq "") { return "NULL" }
  $d = ("$val").Split("T")[0]
  $ok = $d.Length -eq 10 -and $d[4] -eq "-" -and $d[7] -eq "-"
  if ($ok) { return "'" + $d + "'" }
  return "NULL"
}

function ToBldg($val) {
  if ($null -eq $val -or "$val" -eq "") { return "NULL" }
  $first = ("$val").Substring(0, 1)
  if ($first -eq "A" -or $first -eq "B" -or $first -eq "C") { return "'" + $first + "'" }
  return "NULL"
}

function Dec($val) {
  return ([double]$val).ToString([System.Globalization.CultureInfo]::InvariantCulture)
}

$script:rowId    = 0
$script:rowParts = @()

function Process-WinnerNode($node, $eventId, $parentId, $depth, $order) {
  $script:rowId++
  $myId      = $script:rowId
  $parentSql = if ($null -eq $parentId) { "NULL" } else { "$parentId" }
  $script:rowParts += "($myId," + (Esc $eventId) + ",$parentSql," + (Esc $node.value) + ",$depth,$order)"
  $ci = 0
  foreach ($child in $node.children) {
    Process-WinnerNode $child $eventId $myId ($depth + 1) $ci
    $ci++
  }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Data Import -- $DB_NAME"
Write-Host "========================================"
Write-Host ""

# 1. floor_floors + floor_info + floor_info_icons
Write-Host -NoNewline "  [1/12] floor ..."
try {
  $fg  = Get-Content "$DataDir\floor-guide.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql = "SET FOREIGN_KEY_CHECKS=0;" + [char]10

  $rows = @(); $i = 0
  foreach ($f in $fg.floors) { $rows += "(" + (Esc $f.id) + "," + (Esc $f.label) + ",$i)"; $i++ }
  $sql += "INSERT INTO floor_floors (id, label, sort_order) VALUES " + ($rows -join ",") + ";" + [char]10

  $infoId = 0
  foreach ($bldg in @("A","B","C")) {
    $bData = $fg.floorInfo.$bldg
    if ($null -eq $bData) { continue }
    foreach ($fid in ($bData | Get-Member -MemberType NoteProperty).Name) {
      $info = $bData.$fid
      $infoId++
      $sql += "INSERT INTO floor_info (id, floor_id, building, title) VALUES ($infoId," + (Esc $fid) + ",'" + $bldg + "'," + (Esc $info.title) + ");" + [char]10
      if ($info.icons -and $info.icons.Count -gt 0) {
        $iRows = @(); $j = 0
        foreach ($icon in $info.icons) { $iRows += "($infoId," + (Esc $icon) + ",$j)"; $j++ }
        $sql += "INSERT INTO floor_info_icons (floor_info_id, file, sort_order) VALUES " + ($iRows -join ",") + ";" + [char]10
      }
    }
  }
  $sql += "SET FOREIGN_KEY_CHECKS=1;"
  Exec-SQL $sql
  Write-Host " OK ($($fg.floors.Count) floors)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 2. banners
Write-Host -NoNewline "  [2/12] banners ..."
try {
  $json = Get-Content "$DataDir\banners.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $rows = @(); $i = 0
  foreach ($b in $json.banners) {
    $rows += "(" + (Esc $b.id) + "," + (Esc $b.file) + "," + (Esc $b.url) + "," + (ToDate $b.startDate) + "," + (ToDate $b.endDate) + ",$i)"; $i++
  }
  Exec-SQL ("INSERT INTO banners (id, file, url, start_date, end_date, sort_order) VALUES " + ($rows -join ",") + ";")
  Write-Host " OK ($i records)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 3. activities + tags + content + hotspots
Write-Host -NoNewline "  [3/12] activities ..."
try {
  $json = Get-Content "$DataDir\activities.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = ""

  $aRows = @(); $i = 0
  foreach ($a in $json.activities) {
    $aRows += "(" + (Esc $a.id) + "," + (Esc $a.title) + "," + (ToDate $a.startDate) + "," + (ToDate $a.endDate) + "," + (Esc $a.ogTitle) + "," + (Esc $a.ogDescription) + "," + (Esc $a.ogImage) + ",$i)"; $i++
  }
  $sql += "INSERT INTO activities (id, title, start_date, end_date, og_title, og_description, og_image, sort_order) VALUES " + ($aRows -join ",") + ";" + [char]10

  $tRows = @()
  foreach ($a in $json.activities) {
    foreach ($tag in $a.tags) { if ("$tag" -ne "") { $tRows += "(" + (Esc $a.id) + "," + (Esc $tag) + ")" } }
  }
  if ($tRows.Count -gt 0) { $sql += "INSERT INTO activity_tags (activity_id, tag) VALUES " + ($tRows -join ",") + ";" + [char]10 }

  $contentId = 0; $cRows = @(); $hRows = @()
  foreach ($a in $json.activities) {
    $ci = 0
    foreach ($c in $a.content) {
      $contentId++
      $cRows += "($contentId," + (Esc $a.id) + "," + (Esc $c.type) + "," + (Esc $c.file) + "," + (Esc $c.videoId) + ",$ci)"; $ci++
      if ($c.hotspots) {
        foreach ($h in $c.hotspots) {
          $hRows += "(" + (Esc $h.id) + ",$contentId," + (Dec $h.x) + "," + (Dec $h.y) + "," + (Dec $h.width) + "," + (Dec $h.height) + "," + (Esc $h.url) + ")"
        }
      }
    }
  }
  if ($cRows.Count -gt 0) { $sql += "INSERT INTO activity_content (id, activity_id, type, file, video_id, sort_order) VALUES " + ($cRows -join ",") + ";" + [char]10 }
  if ($hRows.Count -gt 0) { $sql += "INSERT INTO activity_hotspots (id, activity_content_id, x, y, width, height, url) VALUES " + ($hRows -join ",") + ";" }
  Exec-SQL $sql
  Write-Host " OK ($($json.activities.Count) activities, $contentId content rows)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 4. dm_catalogs + dm_buttons + dm_hotspots
Write-Host -NoNewline "  [4/12] dm_catalogs ..."
try {
  $json = Get-Content "$DataDir\catalog.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = ""

  $cRows = @()
  foreach ($c in $json) {
    $cRows += "(" + (Esc $c.id) + "," + (Esc $c.title) + "," + (Esc $c.subtitle) + "," + (Esc $c.type) + "," + (Esc $c.cover) + "," + (Esc $c.url) + "," + (ToDate $c.startDate) + "," + (ToDate $c.endDate) + "," + [int]$c.order + ")"
  }
  $sql += "INSERT INTO dm_catalogs (id, title, subtitle, type, cover, url, start_date, end_date, sort_order) VALUES " + ($cRows -join ",") + ";" + [char]10

  $bRows = @(); $hRows = @()
  foreach ($c in $json) {
    foreach ($b in $c.button)   { $bRows += "(" + (Esc $c.id) + "," + [int]$b.page + "," + (Esc $b.url) + ")" }
    foreach ($h in $c.hotspots) { $hRows += "(" + (Esc $h.id) + "," + (Esc $c.id) + "," + (Dec $h.x) + "," + (Dec $h.y) + "," + (Dec $h.width) + "," + (Dec $h.height) + "," + (Esc $h.url) + ")" }
  }
  if ($bRows.Count -gt 0) { $sql += "INSERT INTO dm_buttons (catalog_id, page, url) VALUES " + ($bRows -join ",") + ";" + [char]10 }
  if ($hRows.Count -gt 0) { $sql += "INSERT INTO dm_hotspots (id, catalog_id, x, y, width, height, url) VALUES " + ($hRows -join ",") + ";" }
  Exec-SQL $sql
  Write-Host " OK ($($json.Count) catalogs)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 5. food_categories + food_items
Write-Host -NoNewline "  [5/12] food ..."
try {
  $json = Get-Content "$DataDir\food-guide.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = "SET FOREIGN_KEY_CHECKS=0;" + [char]10

  $cRows = @(); $ci = 0
  foreach ($cat in $json.categories) { $cRows += "(" + (Esc $cat.id) + "," + (Esc $cat.label) + ",$ci)"; $ci++ }
  $sql += "INSERT INTO food_categories (id, label, sort_order) VALUES " + ($cRows -join ",") + ";" + [char]10

  $iRows = @(); $ii = 0
  foreach ($cat in $json.categories) {
    $rest = $json.restaurants.($cat.id)
    if ($null -eq $rest) { continue }
    $all = @()
    if ($rest.theme)     { $all += $rest.theme }
    if ($rest.foodcourt) { $all += $rest.foodcourt }
    foreach ($r in $all) {
      $fid = if ("$($r.floor)" -ne "") { Esc $r.floor } else { "NULL" }
      $iRows += "(" + (Esc $cat.id) + "," + (Esc $r.name) + ",$fid," + (ToBldg $r.building) + "," + (Esc $r.phone) + "," + (Esc $r.image) + "," + (Esc $r.description) + ",$ii)"
      $ii++
    }
  }
  if ($iRows.Count -gt 0) { $sql += "INSERT INTO food_items (category_id, name, floor_id, building, phone, logo, description, sort_order) VALUES " + ($iRows -join ",") + ";" + [char]10 }
  $sql += "SET FOREIGN_KEY_CHECKS=1;"
  Exec-SQL $sql
  Write-Host " OK ($ii items)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 6. winners_events + winners_rows
Write-Host -NoNewline "  [6/12] winners ..."
try {
  $json = Get-Content "$DataDir\winners.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = ""

  $eRows = @(); $ei = 0
  foreach ($ev in $json.events) {
    $colsJson = ($ev.columns | ConvertTo-Json -Compress).Replace("'", "''")
    $eRows += "(" + (Esc $ev.id) + "," + (Esc $ev.title) + "," + (Esc $ev.subtitle1) + "," + (Esc $ev.subtitle2) + ",'" + $colsJson + "',$ei)"; $ei++
  }
  $sql += "INSERT INTO winners_events (id, title, subtitle1, subtitle2, columns, sort_order) VALUES " + ($eRows -join ",") + ";" + [char]10

  $script:rowId = 0; $script:rowParts = @()
  foreach ($ev in $json.events) {
    $si = 0
    foreach ($row in $ev.rows) { Process-WinnerNode $row $ev.id $null 0 $si; $si++ }
  }
  if ($script:rowParts.Count -gt 0) {
    $sql += "INSERT INTO winners_rows (id, event_id, parent_id, value, depth, sort_order) VALUES " + ($script:rowParts -join ",") + ";"
  }
  Exec-SQL $sql
  Write-Host " OK ($ei events, $($script:rowId) rows)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 7. gallery_content + gallery_hotspots
Write-Host -NoNewline "  [7/12] gallery ..."
try {
  $json = Get-Content "$DataDir\gallery.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = ""

  $cRows = @(); $hRows = @(); $ci = 0
  foreach ($c in $json.content) {
    $ci++
    $cRows += "($ci," + (Esc $c.type) + "," + (Esc $c.file) + "," + (Esc $c.videoId) + "," + ($ci - 1) + ")"
    if ($c.hotspots) {
      foreach ($h in $c.hotspots) {
        $hRows += "(" + (Esc $h.id) + ",$ci," + (Dec $h.x) + "," + (Dec $h.y) + "," + (Dec $h.width) + "," + (Dec $h.height) + "," + (Esc $h.url) + ")"
      }
    }
  }
  $sql += "INSERT INTO gallery_content (id, type, file, video_id, sort_order) VALUES " + ($cRows -join ",") + ";" + [char]10
  if ($hRows.Count -gt 0) { $sql += "INSERT INTO gallery_hotspots (id, gallery_content_id, x, y, width, height, url) VALUES " + ($hRows -join ",") + ";" }
  Exec-SQL $sql
  Write-Host " OK ($ci items)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 8. home_events
Write-Host -NoNewline "  [8/12] home_events ..."
try {
  $json = Get-Content "$DataDir\home-events.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $rows = @(); $i = 0
  foreach ($e in $json.events) {
    $rows += "(" + (Esc $e.id) + "," + (Esc $e.file) + "," + (Esc $e.url) + "," + (ToDate $e.startDate) + "," + (ToDate $e.endDate) + ",$i)"; $i++
  }
  Exec-SQL ("INSERT INTO home_events (id, file, url, start_date, end_date, sort_order) VALUES " + ($rows -join ",") + ";")
  Write-Host " OK ($i records)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 9. home_promo + home_promo_cards
Write-Host -NoNewline "  [9/12] home_promo ..."
try {
  $json = Get-Content "$DataDir\home-promo.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql  = "INSERT INTO home_promo (title, hero_file, hero_url, left_label, right_label) VALUES (" + (Esc $json.title) + "," + (Esc $json.heroFile) + "," + (Esc $json.heroUrl) + "," + (Esc $json.leftLabel) + "," + (Esc $json.rightLabel) + ");" + [char]10
  $cRows = @()
  foreach ($c in $json.cards) { $cRows += "(1," + [int]$c.slot + "," + (Esc $c.file) + "," + (Esc $c.url) + ")" }
  if ($cRows.Count -gt 0) { $sql += "INSERT INTO home_promo_cards (promo_id, slot, file, url) VALUES " + ($cRows -join ",") + ";" }
  Exec-SQL $sql
  Write-Host " OK" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 10. logo_groups + logos
Write-Host -NoNewline "  [10/12] logos ..."
try {
  $json = Get-Content "$DataDir\logos.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $gRows = @(); $lRows = @(); $gi = 0
  foreach ($g in $json.groups) {
    $gRows += "(" + (Esc $g.id) + ",$gi)"; $gi++
    $li = 0
    foreach ($l in $g.logos) { $lRows += "(" + (Esc $l.id) + "," + (Esc $g.id) + "," + (Esc $l.file) + ",$li)"; $li++ }
  }
  $sql  = "INSERT INTO logo_groups (id, sort_order) VALUES " + ($gRows -join ",") + ";" + [char]10
  if ($lRows.Count -gt 0) { $sql += "INSERT INTO logos (id, group_id, file, sort_order) VALUES " + ($lRows -join ",") + ";" }
  Exec-SQL $sql
  Write-Host " OK ($($json.groups.Count) groups)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 11. config
Write-Host -NoNewline "  [11/12] config ..."
try {
  $json = Get-Content "$DataDir\config.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $rows = @()
  foreach ($key in ($json | Get-Member -MemberType NoteProperty).Name) {
    $rows += "(" + (Esc $key) + "," + (Esc $json.$key) + ")"
  }
  Exec-SQL ("INSERT INTO config (key_name, value) VALUES " + ($rows -join ",") + ";")
  Write-Host " OK ($($rows.Count) keys)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

# 12. page_views + activity_views
Write-Host -NoNewline "  [12/12] tracking ..."
try {
  $json   = Get-Content "$DataDir\tracking.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $sql    = ""
  $pvRows = @()
  foreach ($page in @("home","floor","food","service","winners","feedback","activity")) {
    $pd = $json.$page
    if ($null -eq $pd -or $null -eq $pd.daily) { continue }
    foreach ($day in ($pd.daily | Get-Member -MemberType NoteProperty).Name) {
      $pvRows += "(" + (Esc $page) + ",'" + $day + "',NULL," + [int]($pd.daily.$day) + ")"
    }
  }
  if ($pvRows.Count -gt 0) { $sql += "INSERT INTO page_views (page, date, hour, count) VALUES " + ($pvRows -join ",") + ";" + [char]10 }

  $avRows = @()
  if ($json.activities) {
    foreach ($actId in ($json.activities | Get-Member -MemberType NoteProperty).Name) {
      $ad = $json.activities.$actId
      if ($null -eq $ad -or $null -eq $ad.daily) { continue }
      foreach ($day in ($ad.daily | Get-Member -MemberType NoteProperty).Name) {
        $avRows += "(" + (Esc $actId) + "," + (Esc $ad.title) + ",'" + $day + "',NULL," + [int]($ad.daily.$day) + ")"
      }
    }
  }
  if ($avRows.Count -gt 0) { $sql += "INSERT INTO activity_views (activity_id, title, date, hour, count) VALUES " + ($avRows -join ",") + ";" }
  if ($sql -ne "") { Exec-SQL $sql }
  Write-Host " OK ($($pvRows.Count + $avRows.Count) records)" -ForegroundColor Green
} catch { Write-Host " FAILED: $_" -ForegroundColor Red }

Write-Host ""
Write-Host "========================================"
Write-Host "  Import complete"
Write-Host "========================================"
Write-Host ""
