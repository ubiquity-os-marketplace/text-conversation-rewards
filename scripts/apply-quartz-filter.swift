#!/usr/bin/env swift

import Foundation
import Quartz

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("\(message)\n".utf8))
  exit(1)
}

let arguments = CommandLine.arguments

guard arguments.count == 4 else {
  fail("Usage: apply-quartz-filter.swift <input.pdf> <output.pdf> <filter.qfilter>")
}

let inputURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let filterURL = URL(fileURLWithPath: arguments[3])

guard FileManager.default.fileExists(atPath: inputURL.path) else {
  fail("Input PDF does not exist: \(inputURL.path)")
}

guard FileManager.default.fileExists(atPath: filterURL.path) else {
  fail("Quartz filter does not exist: \(filterURL.path)")
}

guard let document = PDFDocument(url: inputURL) else {
  fail("Could not open PDF: \(inputURL.path)")
}

guard let filter = QuartzFilter(url: filterURL) else {
  fail("Could not open Quartz filter: \(filterURL.path)")
}

let options: [PDFDocumentWriteOption: Any] = [
  PDFDocumentWriteOption(rawValue: "QuartzFilter"): filter,
]

guard document.write(to: outputURL, withOptions: options) else {
  fail("Could not write compressed PDF: \(outputURL.path)")
}
