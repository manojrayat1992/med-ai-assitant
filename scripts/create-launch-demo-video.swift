import AppKit
import AVFoundation
import CoreVideo

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outputDirectory = root.appendingPathComponent("marketing/launch", isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let videoURL = outputDirectory.appendingPathComponent("med-ai-clinical-demo.mov")
let posterURL = outputDirectory.appendingPathComponent("med-ai-clinical-demo-poster.png")
try? FileManager.default.removeItem(at: videoURL)

let width = 1920
let height = 1080
let fps: Int32 = 24

struct Scene {
    let duration: Double
    let eyebrow: String
    let title: String
    let body: String
    let imagePath: String?
    let accent: NSColor
}

let brand = NSColor(calibratedRed: 0.051, green: 0.486, blue: 0.400, alpha: 1.0)
let blue = NSColor(calibratedRed: 0.184, green: 0.424, blue: 0.702, alpha: 1.0)
let amber = NSColor(calibratedRed: 0.698, green: 0.416, blue: 0.086, alpha: 1.0)
let dark = NSColor(calibratedRed: 0.051, green: 0.086, blue: 0.149, alpha: 1.0)

let scenes = [
    Scene(
        duration: 5.0,
        eyebrow: "PRODUCT HUNT LAUNCH DEMO",
        title: "Med-AI Clinical",
        body: "Radiology report QA before clinician sign-off. AI drafts and flags; clinicians review, edit, and approve.",
        imagePath: "marketing/screenshots/app-clinical-workspace.png",
        accent: brand
    ),
    Scene(
        duration: 8.0,
        eyebrow: "STEP 1 / OPERATIONS",
        title: "Start from a clear clinical dashboard.",
        body: "Teams see report volume, analysis status, QA access, platform health, and the fastest routes into review work.",
        imagePath: "marketing/screenshots/app-dashboard.png",
        accent: blue
    ),
    Scene(
        duration: 10.0,
        eyebrow: "STEP 2 / REVIEW",
        title: "Open the clinical workspace.",
        body: "The reviewer sees report text, AI issue flags, evidence context, anatomy mapping, and the sign-off state in one working surface.",
        imagePath: "marketing/screenshots/app-clinical-workspace.png",
        accent: brand
    ),
    Scene(
        duration: 8.0,
        eyebrow: "STEP 3 / GOVERNANCE",
        title: "Move cases through the QA worklist.",
        body: "Critical acknowledgement, pending review, and signed reports stay visible so the workflow does not become a black box.",
        imagePath: "marketing/screenshots/app-worklist.png",
        accent: brand
    ),
    Scene(
        duration: 8.0,
        eyebrow: "STEP 4 / PILOT EVIDENCE",
        title: "Measure the pilot, not the hype.",
        body: "QA analytics shows acceptance, correction, rejection, and escalation patterns that help a buyer decide whether to continue.",
        imagePath: "marketing/screenshots/app-qa-analytics.png",
        accent: blue
    ),
    Scene(
        duration: 7.0,
        eyebrow: "STEP 5 / ENTERPRISE PATH",
        title: "Keep integrations honest.",
        body: "PACS, RIS, reporting, and SSO are positioned as planned enterprise work until each integration is connected and tested.",
        imagePath: "marketing/screenshots/app-integrations.png",
        accent: amber
    ),
    Scene(
        duration: 6.0,
        eyebrow: "CALL TO ACTION",
        title: "Request an 8-week supervised validation pilot.",
        body: "Best for imaging teams that want to validate report QA value with clinician review before production rollout.",
        imagePath: "marketing/screenshots/app-dashboard.png",
        accent: brand
    ),
]

func image(_ relativePath: String?) -> NSImage? {
    guard let relativePath else { return nil }
    return NSImage(contentsOf: root.appendingPathComponent(relativePath))
}

func rgba(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(calibratedRed: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
}

func drawRoundedRect(_ rect: CGRect, radius: CGFloat, color: NSColor) {
    color.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func strokeRoundedRect(_ rect: CGRect, radius: CGFloat, color: NSColor, width: CGFloat) {
    color.setStroke()
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    path.lineWidth = width
    path.stroke()
}

func drawText(_ text: String, in rect: CGRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, lineHeight: CGFloat = 1.18) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.lineSpacing = max(0, size * (lineHeight - 1))
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
        .kern: 0,
    ]
    NSAttributedString(string: text, attributes: attributes).draw(in: rect)
}

func drawPill(_ text: String, at origin: CGPoint, color: NSColor) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 24, weight: .bold),
        .foregroundColor: NSColor.white,
        .kern: 0.6,
    ]
    let size = (text as NSString).size(withAttributes: attributes)
    let rect = CGRect(x: origin.x, y: origin.y, width: size.width + 36, height: 46)
    drawRoundedRect(rect, radius: 23, color: color)
    NSAttributedString(string: text, attributes: attributes).draw(at: CGPoint(x: rect.minX + 18, y: rect.minY + 9))
}

func drawImage(_ image: NSImage, fill rect: CGRect, zoom: CGFloat = 1.0, offsetY: CGFloat = 0) {
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
    let sourceWidth = CGFloat(cgImage.width)
    let sourceHeight = CGFloat(cgImage.height)
    let scale = max(rect.width / sourceWidth, rect.height / sourceHeight) * zoom
    let drawWidth = sourceWidth * scale
    let drawHeight = sourceHeight * scale
    let drawRect = CGRect(
        x: rect.midX - drawWidth / 2,
        y: rect.midY - drawHeight / 2 + offsetY,
        width: drawWidth,
        height: drawHeight
    )
    NSGraphicsContext.current?.cgContext.saveGState()
    NSBezierPath(roundedRect: rect, xRadius: 18, yRadius: 18).addClip()
    NSImage(cgImage: cgImage, size: .zero).draw(in: drawRect)
    NSGraphicsContext.current?.cgContext.restoreGState()
}

func renderScene(_ scene: Scene, localProgress: CGFloat, into context: CGContext) {
    let paper = rgba(251, 250, 247)
    let ink = rgba(16, 20, 19)
    let muted = rgba(101, 115, 111)
    let line = rgba(222, 217, 203)
    let progress = min(max(localProgress, 0), 1)
    let ease = 0.5 - cos(progress * .pi) / 2

    paper.setFill()
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    if scene.eyebrow.contains("PRODUCT HUNT") {
        if let screenshot = image(scene.imagePath) {
            drawImage(screenshot, fill: CGRect(x: -80, y: -60, width: CGFloat(width) + 160, height: CGFloat(height) + 120), zoom: 1.04 + ease * 0.03)
            NSColor(calibratedWhite: 0.02, alpha: 0.74).setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
        drawPill(scene.eyebrow, at: CGPoint(x: 128, y: 182), color: scene.accent)
        drawText(scene.title, in: CGRect(x: 128, y: 258, width: 980, height: 140), size: 88, weight: .heavy, color: .white, lineHeight: 1.0)
        drawText(scene.body, in: CGRect(x: 132, y: 416, width: 1040, height: 150), size: 36, weight: .medium, color: NSColor(calibratedWhite: 1, alpha: 0.86), lineHeight: 1.25)
        drawText("medaiclinical.com", in: CGRect(x: 132, y: 858, width: 360, height: 42), size: 28, weight: .bold, color: NSColor(calibratedWhite: 1, alpha: 0.72))
        return
    }

    let left = CGRect(x: 96, y: 122, width: 610, height: 838)
    let right = CGRect(x: 760, y: 112, width: 1068, height: 772)
    drawPill(scene.eyebrow, at: CGPoint(x: left.minX, y: left.minY + 8), color: scene.accent)
    drawText(scene.title, in: CGRect(x: left.minX, y: left.minY + 86, width: left.width, height: 245), size: 62, weight: .heavy, color: ink, lineHeight: 1.02)
    drawText(scene.body, in: CGRect(x: left.minX + 2, y: left.minY + 360, width: left.width - 24, height: 210), size: 30, weight: .regular, color: muted, lineHeight: 1.22)

    drawRoundedRect(CGRect(x: left.minX, y: left.minY + 662, width: 480, height: 94), radius: 8, color: NSColor.white)
    strokeRoundedRect(CGRect(x: left.minX, y: left.minY + 662, width: 480, height: 94), radius: 8, color: line, width: 2)
    drawText("Clinical rule", in: CGRect(x: left.minX + 28, y: left.minY + 678, width: 250, height: 32), size: 22, weight: .bold, color: scene.accent)
    drawText("AI assists. A qualified clinician reviews and signs.", in: CGRect(x: left.minX + 28, y: left.minY + 710, width: 420, height: 36), size: 20, weight: .medium, color: muted)

    drawRoundedRect(right.insetBy(dx: -16, dy: -16), radius: 26, color: NSColor.white)
    strokeRoundedRect(right.insetBy(dx: -16, dy: -16), radius: 26, color: line, width: 2)
    if let screenshot = image(scene.imagePath) {
        drawImage(screenshot, fill: right, zoom: 1.0 + ease * 0.035, offsetY: (ease - 0.5) * 20)
    } else {
        drawRoundedRect(right, radius: 18, color: dark)
    }

    drawRoundedRect(CGRect(x: right.minX + 34, y: right.maxY - 86, width: 410, height: 52), radius: 8, color: NSColor(calibratedWhite: 0.02, alpha: 0.78))
    drawText("Synthetic demo data shown", in: CGRect(x: right.minX + 54, y: right.maxY - 75, width: 370, height: 32), size: 20, weight: .bold, color: NSColor.white)
}

func makePixelBuffer(width: Int, height: Int) -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let attributes: [String: Any] = [
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
    let status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attributes as CFDictionary, &pixelBuffer)
    guard status == kCVReturnSuccess, let pixelBuffer else {
        fatalError("Could not create pixel buffer.")
    }
    return pixelBuffer
}

func renderFrame(scene: Scene, localProgress: CGFloat, to pixelBuffer: CVPixelBuffer) {
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixelBuffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else {
        fatalError("Could not create CGContext.")
    }

    let graphicsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext
    renderScene(scene, localProgress: localProgress, into: context)
    NSGraphicsContext.restoreGraphicsState()
}

let writer = try AVAssetWriter(outputURL: videoURL, fileType: .mov)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)

guard writer.canAdd(input) else { fatalError("Cannot add video input.") }
writer.add(input)
guard writer.startWriting() else { fatalError(writer.error?.localizedDescription ?? "Could not start writer.") }
writer.startSession(atSourceTime: .zero)

var frameIndex: Int64 = 0
let totalFrames = scenes.reduce(0) { $0 + Int(round($1.duration * Double(fps))) }

for scene in scenes {
    let sceneFrames = Int(round(scene.duration * Double(fps)))
    for localFrame in 0..<sceneFrames {
        while !input.isReadyForMoreMediaData {
            Thread.sleep(forTimeInterval: 0.005)
        }
        let pixelBuffer = makePixelBuffer(width: width, height: height)
        let localProgress = CGFloat(localFrame) / CGFloat(max(sceneFrames - 1, 1))
        renderFrame(scene: scene, localProgress: localProgress, to: pixelBuffer)
        let time = CMTime(value: frameIndex, timescale: fps)
        guard adaptor.append(pixelBuffer, withPresentationTime: time) else {
            fatalError(writer.error?.localizedDescription ?? "Could not append video frame.")
        }
        frameIndex += 1
        if frameIndex % Int64(fps * 4) == 0 {
            print("Rendered \(frameIndex)/\(totalFrames) frames")
        }
    }
}

input.markAsFinished()
writer.finishWriting {
    if let error = writer.error {
        fatalError(error.localizedDescription)
    }
    print("Video: \(videoURL.path)")
}

while writer.status == .writing {
    Thread.sleep(forTimeInterval: 0.05)
}

let posterBuffer = makePixelBuffer(width: width, height: height)
renderFrame(scene: scenes[0], localProgress: 0.35, to: posterBuffer)
CVPixelBufferLockBaseAddress(posterBuffer, [])
if let context = CGContext(
    data: CVPixelBufferGetBaseAddress(posterBuffer),
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(posterBuffer),
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
), let cgImage = context.makeImage() {
    let bitmap = NSBitmapImageRep(cgImage: cgImage)
    if let data = bitmap.representation(using: .png, properties: [:]) {
        try data.write(to: posterURL)
        print("Poster: \(posterURL.path)")
    }
}
CVPixelBufferUnlockBaseAddress(posterBuffer, [])
