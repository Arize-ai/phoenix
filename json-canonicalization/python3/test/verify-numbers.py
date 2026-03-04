##############################################################################
#                                                                            #
#  Copyright 2006-2019 WebPKI.org (http://webpki.org).                       #
#                                                                            #
#  Licensed under the Apache License, Version 2.0 (the "License");           #
#  you may not use this file except in compliance with the License.          #
#  You may obtain a copy of the License at                                   #
#                                                                            #
#      https://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                            #
#  Unless required by applicable law or agreed to in writing, software       #
#  distributed under the License is distributed on an "AS IS" BASIS,         #
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#  See the License for the specific language governing permissions and       #
#  limitations under the License.                                            #
#                                                                            #
##############################################################################

# Test program for ES6-JSON/JCS number serialization

import binascii
import struct

from org.webpki.json.NumberToJson import convert2Es6Format

INVALID_NUMBER = 'null'

#
# Test program using a 100 million value file formatted as follows:
# value in ieee hex representation (1-16 digits) + ',' + correct ES6 format + '\n'
#
def verify(ieeeHex, expected):
    while len(ieeeHex) < 16:
        ieeeHex = '0' + ieeeHex
    value = struct.unpack('>d',binascii.a2b_hex(ieeeHex))[0]
    try:
        pyFormat = convert2Es6Format(value)
    except ValueError:
        if expected == INVALID_NUMBER:
            return
    if pyFormat == expected and value == float(pyFormat) and repr(value) == str(value):
        return
    print('IEEE:   ' + ieeeHex + '\nPython: ' + pyFormat + '\nExpected: ' + expected)
    exit(0)

verify('4340000000000001', '9007199254740994')
verify('4340000000000002', '9007199254740996')
verify('444b1ae4d6e2ef50', '1e+21')
verify('3eb0c6f7a0b5ed8d', '0.000001')
verify('3eb0c6f7a0b5ed8c', '9.999999999999997e-7')
verify('8000000000000000', '0')
verify('7fffffffffffffff', INVALID_NUMBER)
verify('7ff0000000000000', INVALID_NUMBER)
verify('fff0000000000000', INVALID_NUMBER)
# Change the file path below according to your installation
file = open('c:\\es6\\numbers\\es6testfile100m.txt','r')
lineCount = 0;
while True:
    line = file.readline();
    if not line:
        print('\nSuccessful Operation. Lines read: ' + str(lineCount))
        exit(0)
    lineCount = lineCount + 1;
    i = line.find(',')
    if i <= 0 or i >= len(line) - 1:
        print('Bad line: ' + line)
        exit(0)
    verify(line[:i], line[i + 1:len(line) - 1])
    if lineCount % 1000000 == 0:
        print('Line: ' + str(lineCount))
