# Milimg.js

Milimg is a internal image format used by Milthm which acts as a simple AV1 container. This is a reference milimg encoder and decoder based on WebCodecs API.

> **Note**: This library only supports browser environment, requires WebCodecs API support
> For unknown reason, some jpeg image may not be encoded successfully

## Install

```bash
npm install milimg
# or
yarn add milimg
```

Or use CDN

```html
<script type="module">
  import {
    decodeMilimg,
    encodeMilimg
  } from 'https://cdn.jsdelivr.net/npm/milimg/lib/index.js';
</script>
```

## Quick Start

### Encode Image

```typescript
import { encodeMilimg } from 'milimg';

const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const arrayBuffer = await file.arrayBuffer();
const imageBuffer = Buffer.from(arrayBuffer);

const milimgBuffer = await encodeMilimg(imageBuffer, 0);
```

### Decode Image

```typescript
import { decodeMilimg } from 'milimg';

const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const arrayBuffer = await file.arrayBuffer();
const milimgBuffer = Buffer.from(arrayBuffer);

const pngBuffer = await decodeMilimg(milimgBuffer);
```

## API

### `encodeMilimg(imageBuffer: Buffer, quality?: number): Promise<Buffer>`

Encode image to milimg format

**Parameters:**
- `imageBuffer` - Image file buffer (support PNG/JPEG/WebP format)
- `quality` - Encoding quality(qp) (0-63), the lower the quality, the higher the quality, default is 0

**Returns:**
- `Promise<Buffer>` - milimg buffer

**Example:**
```typescript
const milimgBuffer = await encodeMilimg(imageBuffer, 28);
```

### `decodeMilimg(buffer: Buffer): Promise<Buffer>`

Decode milimg format to PNG

**Parameters:**
- `buffer` - milimg buffer

**Returns:**
- `Promise<Buffer>` - PNG buffer

**Example:**
```typescript
const pngBuffer = await decodeMilimg(milimgBuffer);
```

### `parseMilimgContainer(buffer: Buffer): MilimgHeader`

Parse milimg container header

**Parameters:**
- `buffer` - milimg buffer

**Returns:**
- `MilimgHeader` - Object containing version, size, and payload information

**Example:**
```typescript
const header = parseMilimgContainer(milimgBuffer);
console.log(header.width, header.height, header.version);
```

### Version Description

- **Version 0**: Image without alpha channel
- **Version 1**: Image with alpha channel (RGBA)

## Credits

The format is created by [Eric_Lian](https://github.com/exercisebook) and have been used since Milthm 1.4. The library is created by [Q78KG](https://github.com/Hoshino-Yumetsuki) based on reverse engineering results, later the technical disclosure is authorized.
