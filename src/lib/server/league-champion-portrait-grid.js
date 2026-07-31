import sharp from "sharp";

const STANDARD_TEAM_SIZE = 5;
const PORTRAIT_COLUMNS = 5;
const PORTRAIT_TILE_SIZE = 144;
const PORTRAIT_LABEL_HEIGHT = 30;
const PORTRAIT_TILE_GAP = 12;
const PORTRAIT_GRID_PADDING = 16;

function isLeagueCyanTeamAccentPixel(red, green, blue) {
  return green >= 70
    && blue >= 70
    && green >= red * 1.3
    && blue >= red * 1.3;
}

function isLeagueRedTeamAccentPixel(red, green, blue) {
  return red >= 70
    && red >= green * 1.5
    && red >= blue * 1.25;
}

function isLeagueGoldBorderPixel(red, green, blue) {
  return red >= 95
    && green >= 58
    && blue <= 145
    && red >= green * 1.03
    && green >= blue * 0.92;
}

function goldPixelScore({ data, width, height }, centerX, centerY, halfSize) {
  const left = Math.max(0, centerX - halfSize);
  const right = Math.min(width - 1, centerX + halfSize);
  const top = Math.max(0, centerY - halfSize);
  const bottom = Math.min(height - 1, centerY + halfSize);
  let score = 0;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = (y * width + x) * 3;
      if (isLeagueGoldBorderPixel(data[index], data[index + 1], data[index + 2])) {
        score += 1;
      }
    }
  }

  return score;
}

function findTeamStart(image, {
  centerX,
  rowCount,
  rowSpacing,
  halfSize,
  minimumY,
  maximumY,
}) {
  let best = { centerY: Math.round((minimumY + maximumY) / 2), score: -1 };

  for (let centerY = minimumY; centerY <= maximumY; centerY += 1) {
    let score = 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      score += goldPixelScore(image, centerX, centerY + rowIndex * rowSpacing, halfSize);
    }
    if (score > best.score) best = { centerY, score };
  }

  return best;
}

function collectVerticalSegments(values, maximumGap = 3) {
  if (!values.length) return [];

  const segments = [];
  let start = values[0];
  let previous = values[0];

  for (const value of values.slice(1)) {
    if (value - previous > maximumGap) {
      segments.push({ start, end: previous });
      start = value;
    }
    previous = value;
  }
  segments.push({ start, end: previous });
  return segments;
}

function findTeamAccentRange(image, pixelMatcher) {
  const minimumX = Math.max(0, Math.round(image.width * 0.015));
  const maximumX = Math.min(image.width - 1, Math.round(image.width * 0.04));
  const minimumMatchesPerRow = Math.max(3, Math.round((maximumX - minimumX + 1) * 0.08));
  const matchingRows = [];

  for (let y = 0; y < image.height; y += 1) {
    let matches = 0;
    for (let x = minimumX; x <= maximumX; x += 1) {
      const index = (y * image.width + x) * 3;
      if (pixelMatcher(image.data[index], image.data[index + 1], image.data[index + 2])) {
        matches += 1;
      }
    }
    if (matches >= minimumMatchesPerRow) matchingRows.push(y);
  }

  const minimumSegmentHeight = Math.max(18, Math.round(image.height * 0.045));
  const majorSegments = collectVerticalSegments(matchingRows)
    .filter((segment) => segment.end - segment.start + 1 >= minimumSegmentHeight);
  if (!majorSegments.length) return null;

  const maximumMergeGap = Math.round(image.height * 0.1);
  const mergedSegments = [];
  for (const segment of majorSegments) {
    const previous = mergedSegments[mergedSegments.length - 1];
    if (previous && segment.start - previous.end <= maximumMergeGap) {
      previous.end = segment.end;
    } else {
      mergedSegments.push({ ...segment });
    }
  }

  return mergedSegments
    .sort((first, second) => (second.end - second.start) - (first.end - first.start))[0];
}

function accentBarLeaguePortraitLayout({ data, width, height, rowCount }) {
  if (!data?.length || rowCount < 2) return null;

  const firstTeamRows = Math.min(STANDARD_TEAM_SIZE, rowCount);
  const secondTeamRows = Math.max(0, rowCount - firstTeamRows);
  if (!secondTeamRows) return null;

  const image = { data, width, height };
  const firstTeam = findTeamAccentRange(image, isLeagueCyanTeamAccentPixel);
  const secondTeam = findTeamAccentRange(image, isLeagueRedTeamAccentPixel);
  if (!firstTeam || !secondTeam || firstTeam.end >= secondTeam.start) return null;

  const firstSpacing = (firstTeam.end - firstTeam.start + 1) / firstTeamRows;
  const secondSpacing = (secondTeam.end - secondTeam.start + 1) / secondTeamRows;
  const minimumSpacing = height * 0.045;
  const maximumSpacing = height * 0.1;
  if (
    firstSpacing < minimumSpacing
    || firstSpacing > maximumSpacing
    || secondSpacing < minimumSpacing
    || secondSpacing > maximumSpacing
  ) {
    return null;
  }

  const rowSpacing = (firstSpacing + secondSpacing) / 2;
  const centerX = Math.round(width * 0.117);
  const buildPositions = (team, teamRows, startingRowIndex) => Array.from(
    { length: teamRows },
    (_, index) => ({
      rowIndex: startingRowIndex + index,
      centerX,
      centerY: Math.round(team.start + (index + 0.5) * ((team.end - team.start + 1) / teamRows)),
    }),
  );

  return {
    centerX,
    rowSpacing: Math.round(rowSpacing),
    cropSize: Math.max(26, Math.round(rowSpacing * 0.88)),
    detectionMode: "team_accent_bars_detected",
    detectionScore: (firstTeam.end - firstTeam.start + 1) + (secondTeam.end - secondTeam.start + 1),
    positions: [
      ...buildPositions(firstTeam, firstTeamRows, 1),
      ...buildPositions(secondTeam, secondTeamRows, firstTeamRows + 1),
    ],
  };
}

function normalizedLeaguePortraitLayout(width, height, rowCount) {
  const firstTeamRows = Math.min(STANDARD_TEAM_SIZE, rowCount);
  const secondTeamRows = Math.max(0, rowCount - firstTeamRows);
  const rowSpacing = Math.max(20, Math.round(height * 0.061));
  const centerX = Math.round(width * 0.117);
  const firstTeamStart = Math.round(height * 0.328);
  const secondTeamStart = Math.round(height * 0.692);

  return {
    centerX,
    rowSpacing,
    cropSize: Math.max(26, Math.round(height * 0.059)),
    detectionMode: "normalized_fallback",
    detectionScore: 0,
    positions: [
      ...Array.from({ length: firstTeamRows }, (_, index) => ({
        rowIndex: index + 1,
        centerX,
        centerY: firstTeamStart + index * rowSpacing,
      })),
      ...Array.from({ length: secondTeamRows }, (_, index) => ({
        rowIndex: firstTeamRows + index + 1,
        centerX,
        centerY: secondTeamStart + index * rowSpacing,
      })),
    ],
  };
}

export function locateLeagueMatchHistoryPortraits({ data, width, height, rowCount = 10 }) {
  const accentBarLayout = accentBarLeaguePortraitLayout({ data, width, height, rowCount });
  if (accentBarLayout) return accentBarLayout;

  const normalized = normalizedLeaguePortraitLayout(width, height, rowCount);
  if (!data?.length || rowCount <= 0) return normalized;

  const firstTeamRows = Math.min(STANDARD_TEAM_SIZE, rowCount);
  const secondTeamRows = Math.max(0, rowCount - firstTeamRows);
  const halfSize = Math.max(12, Math.round(normalized.cropSize * 0.47));
  const centerX = normalized.centerX;
  const firstTeam = findTeamStart({ data, width, height }, {
    centerX,
    rowCount: firstTeamRows,
    rowSpacing: normalized.rowSpacing,
    halfSize,
    minimumY: Math.round(height * 0.31),
    maximumY: Math.round(height * 0.34),
  });
  const secondTeam = secondTeamRows
    ? findTeamStart({ data, width, height }, {
      centerX,
      rowCount: secondTeamRows,
      rowSpacing: normalized.rowSpacing,
      halfSize,
      minimumY: Math.round(height * 0.68),
      maximumY: Math.round(height * 0.705),
    })
    : { centerY: 0, score: 0 };
  const score = firstTeam.score + secondTeam.score;

  if (score < rowCount * 8) return normalized;

  return {
    centerX,
    rowSpacing: normalized.rowSpacing,
    cropSize: normalized.cropSize,
    detectionMode: "gold_border_detected",
    detectionScore: score,
    positions: [
      ...Array.from({ length: firstTeamRows }, (_, index) => ({
        rowIndex: index + 1,
        centerX,
        centerY: firstTeam.centerY + index * normalized.rowSpacing,
      })),
      ...Array.from({ length: secondTeamRows }, (_, index) => ({
        rowIndex: firstTeamRows + index + 1,
        centerX,
        centerY: secondTeam.centerY + index * normalized.rowSpacing,
      })),
    ],
  };
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildLeagueChampionPortraitGrid(imageBuffer, rowCount = 10) {
  const orientedBuffer = await sharp(imageBuffer, { failOn: "none" })
    .rotate()
    .removeAlpha()
    .png()
    .toBuffer();
  const { data, info } = await sharp(orientedBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const layout = locateLeagueMatchHistoryPortraits({
    data,
    width: info.width,
    height: info.height,
    rowCount,
  });
  const rows = Math.ceil(layout.positions.length / PORTRAIT_COLUMNS);
  const cellWidth = PORTRAIT_TILE_SIZE + PORTRAIT_TILE_GAP;
  const cellHeight = PORTRAIT_LABEL_HEIGHT + PORTRAIT_TILE_SIZE + PORTRAIT_TILE_GAP;
  const width = PORTRAIT_GRID_PADDING * 2 + PORTRAIT_COLUMNS * cellWidth - PORTRAIT_TILE_GAP;
  const height = PORTRAIT_GRID_PADDING * 2 + rows * cellHeight - PORTRAIT_TILE_GAP;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#08131c"/>
      ${layout.positions.map((position, index) => {
        const column = index % PORTRAIT_COLUMNS;
        const row = Math.floor(index / PORTRAIT_COLUMNS);
        const x = PORTRAIT_GRID_PADDING + column * cellWidth;
        const y = PORTRAIT_GRID_PADDING + row * cellHeight;
        return `
          <rect x="${x}" y="${y}" width="${PORTRAIT_TILE_SIZE}" height="${PORTRAIT_LABEL_HEIGHT + PORTRAIT_TILE_SIZE}" rx="9" fill="#111f2c" stroke="#597086"/>
          <text x="${x + PORTRAIT_TILE_SIZE / 2}" y="${y + 21}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" text-anchor="middle">${escapeXml(`Row ${position.rowIndex}`)}</text>
        `;
      }).join("")}
    </svg>
  `;
  const composites = [];
  const halfCrop = Math.floor(layout.cropSize / 2);

  for (const [index, position] of layout.positions.entries()) {
    const left = Math.max(0, Math.min(info.width - layout.cropSize, position.centerX - halfCrop));
    const top = Math.max(0, Math.min(info.height - layout.cropSize, position.centerY - halfCrop));
    const input = await sharp(orientedBuffer, { failOn: "none" })
      .extract({ left, top, width: layout.cropSize, height: layout.cropSize })
      .resize(PORTRAIT_TILE_SIZE, PORTRAIT_TILE_SIZE, { fit: "fill", kernel: "lanczos3" })
      .sharpen()
      .png()
      .toBuffer();
    const column = index % PORTRAIT_COLUMNS;
    const row = Math.floor(index / PORTRAIT_COLUMNS);
    composites.push({
      input,
      left: PORTRAIT_GRID_PADDING + column * cellWidth,
      top: PORTRAIT_GRID_PADDING + row * cellHeight + PORTRAIT_LABEL_HEIGHT,
    });
  }

  return {
    buffer: await sharp(Buffer.from(svg)).composite(composites).png().toBuffer(),
    mimeType: "image/png",
    layout,
  };
}
