# Third-party notices

Inkleaf's checked-in browser bundle includes the following open-source libraries. Copyright and license headers embedded in the distributed JavaScript files are preserved.

| Library | Version | License | Source |
|---|---:|---|---|
| React and React DOM | 18.3.1 | MIT | <https://github.com/facebook/react> |
| epub.js | 0.3.93 | BSD-2-Clause | <https://github.com/futurepress/epub.js> |
| Lucide React | 0.468.0 | ISC | <https://github.com/lucide-icons/lucide> |
| JSZip | bundled by epub.js | MIT or GPL-3.0; Inkleaf uses it under MIT | <https://github.com/Stuk/jszip> |
| pako | bundled by JSZip | MIT | <https://github.com/nodeca/pako> |
| PDF.js | 6.3.289 | Apache-2.0 | <https://github.com/mozilla/pdf.js> |

PDF.js is bundled locally under `dist/vendor/pdfjs/`, including its worker, fonts, character maps and WebAssembly resources. Its license is included as `dist/vendor/pdfjs/LICENSE`; additional component license files shipped with these resources are retained.

## epub.js BSD-2-Clause notice

Copyright (c) 2013, FuturePress. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation are those of the authors and should not be interpreted as representing official policies, either expressed or implied, of the FreeBSD Project.

The other listed libraries' license notices remain in their distributed bundle headers and are available from the linked upstream repositories.
