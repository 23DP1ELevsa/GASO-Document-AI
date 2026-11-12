import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

// An independent PDF reader verifies text, drawn image order, pixels and page bounds.
export async function readPdf(bytes) {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  })
  const pdf = await task.promise
  try {
    const pages = []
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index)
      const text = await page.getTextContent()
      const operators = await page.getOperatorList()
      const images = []
      for (let i = 0; i < operators.fnArray.length; i++) {
        if (operators.fnArray[i] === OPS.paintImageXObject) {
          const [name] = operators.argsArray[i]
          const image = await new Promise((resolve) => page.objs.get(name, resolve))
          const sample = image.data ? [...image.data.slice(0, 4)] : null
          images.push({ width: image.width, height: image.height, sample })
        }
      }
      pages.push({
        width: page.view[2] - page.view[0],
        height: page.view[3] - page.view[1],
        text: text.items
          .filter((item) => 'str' in item)
          .map((item) => item.str)
          .join(' '),
        textItems: text.items
          .filter((item) => 'str' in item)
          .map(({ str, transform, width, height }) => ({
            text: str,
            x: transform[4],
            y: transform[5],
            width,
            height,
          })),
        images,
      })
      page.cleanup()
    }
    return { pageCount: pdf.numPages, pages }
  } finally {
    await task.destroy()
  }
}
