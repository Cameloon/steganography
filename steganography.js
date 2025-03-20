//load image for latet encoding and decoding  --> only png!!! eg. not jpeg due to compression -> lost LSB
document.getElementById('imageInput').addEventListener('change', () => {
    const imageInput = document.getElementById('imageInput');
    const image = document.getElementById('image');
    const file = imageInput.files[0];
    const reader = new FileReader();

    //check if pic is png and only allow png, otherwise throw an error code here:

    reader.onload = (event) => {
        image.onload = () => {
            image.style.display = 'block'; /* was block or flex */
        };
        image.src = event.target.result;
    };

    if (file) {
        reader.readAsDataURL(file);
    }
});

//same as above but for dropzone, thx to:_ https://www.mediaevent.de/javascript/drag-drop-file-upload.html#nav_menu
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('imageInput');

//drang and drop handlers
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        //check if pic is png and only allow png, otherwise throw an error code here:
        if(!files[0].type.match('image/png')) {
            alert('As written in the heading this only works with PNG files!');
            return;
        }
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        fileInput.files = dataTransfer.files;
        
        //triggers change handler?
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    }
});

// encodw password into the image
document.getElementById('encodeButton').addEventListener('click', async function () {
    const password = document.getElementById('passwordInput').value;
    const encryptionKey = document.getElementById('encryptionKeyInput').value;

    if (!password || !encryptionKey) {
        alert('Please enter both password and encryption key.');
        return;
    }

    const image = document.getElementById('image');
    if (!image.src) {
        alert('Please upload an image first.');
        return;
    }

    //create temp. image with og dimensions because of scaled down version fucks the embedded pic
    const tempImage = new Image();
    tempImage.src = image.src;
    await new Promise(resolve => tempImage.onload = resolve);

    // cerate encryption key from input - has to be 32 bit
    const keyBuffer = new TextEncoder().encode(encryptionKey);
    const paddedKeyBuffer = new Uint8Array(32);
    paddedKeyBuffer.set(keyBuffer.slice(0, 32));

    const key = await crypto.subtle.importKey(
        'raw',
        paddedKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12)); //random 12-byte initializaion vector (IV) for AES-GCM
    //
    const encodedPassword = new TextEncoder().encode(password);

    try {
        const encryptedBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedPassword
        );

        //now using the original dimensions of img insteead of previous img (naturalWidth +height)
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = tempImage.naturalWidth;
        canvas.height = tempImage.naturalHeight;
        ctx.drawImage(tempImage, 0, 0, tempImage.naturalWidth, tempImage.naturalHeight); //??like this

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const encryptedArray = new Uint8Array(encryptedBuffer);
        const encryptedLength = encryptedArray.length;

        //store encrypted data length as 4 bytes(as little-endian = eg.: 0x12345678 = 0x78, 0x56, 0x34, 0x12)
        const lengthBuffer = new ArrayBuffer(4);
        new DataView(lengthBuffer).setUint32(0, encryptedLength, true);
        const lengthArray = new Uint8Array(lengthBuffer);

        // convert it into binary strings for later embing into LSB of pic 
        const ivBinary = Array.from(iv).map(byte => byte.toString(2).padStart(8, '0')).join('');
        const lengthBinary = Array.from(lengthArray).map(byte => byte.toString(2).padStart(8, '0')).join('');
        const encryptedBinary = Array.from(encryptedArray).map(byte => byte.toString(2).padStart(8, '0')).join('');
        // all of the above combied
        const totalBinary = ivBinary + lengthBinary + encryptedBinary;

        //check capacity of pic
        if (totalBinary.length > data.length * 0.75) {
            alert('Data exceeds the pixel capacity of the image. Please use a larger image.');
            return;
        }

        //embed the previois binary data 
        let binaryIndex = 0;
        for (let i = 0; i < data.length && binaryIndex < totalBinary.length; i += 4) {
            data[i] = (data[i] & 0xFE) | parseInt(totalBinary[binaryIndex++] || 0, 2);
            if (binaryIndex < totalBinary.length) data[i+1] = (data[i+1] & 0xFE) | parseInt(totalBinary[binaryIndex++] || 0, 2);
            if (binaryIndex < totalBinary.length) data[i+2] = (data[i+2] & 0xFE) | parseInt(totalBinary[binaryIndex++] || 0, 2);
        }

        ctx.putImageData(imageData, 0, 0);
        image.src = canvas.toDataURL();
        /* const encodedImageURL = canvas.toDataURL();
        image.src = encodedImageURL; */

        alert('Password encoded into the image successfully.');
    } catch (error) {
        console.error('Error during encryption:', error);
    }
});

// download encoded image
document.getElementById('downloadButton').addEventListener('click', function () {
    const imageDataURL = document.getElementById('image').src;
    if (!imageDataURL) {
        alert('Please encode an image first.');
        return;
    }

    const link = document.createElement('a');
    link.href = imageDataURL;
    link.download = 'encoded_image.png';
    link.click();
});


//for decodoing the password from the previously encoded image - thx internet
document.getElementById('decodeButton').addEventListener('click', async function () {
    const encryptionKey = document.getElementById('encryptionKeyInput').value;
    const image = document.getElementById('image');

    if (!encryptionKey) {
        alert('Please provide an encryption key.');
        return;
    }
    if (!image.src) {
        alert('Please upload an encoded image first.');
        return;
    }

    //again temp image for og dimensions of img
    const tempImage = new Image();
    tempImage.src = image.src;
    await new Promise(resolve => tempImage.onload = resolve);

    // to ceate the encryption key from inputted key
    const keyBuffer = new TextEncoder().encode(encryptionKey);
    const paddedKeyBuffer = new Uint8Array(32);
    paddedKeyBuffer.set(keyBuffer.slice(0, 32));

    const key = await crypto.subtle.importKey(
        'raw',
        paddedKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    //like in encoding, using the original dimensions
    canvas.width = tempImage.naturalWidth;
    canvas.height = tempImage.naturalHeight;
    ctx.drawImage(tempImage, 0, 0, tempImage.naturalWidth, tempImage.naturalHeight);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // extracs LSBs from RGB channels which each are 8bit value 
    const binaryData = [];
    for (let i = 0; i < data.length; i += 4) {
        binaryData.push((data[i] & 1).toString());
        binaryData.push((data[i + 1] & 1).toString());
        binaryData.push((data[i + 2] & 1).toString());
    }

    const binaryString = binaryData.join('');

    //extract tje nitializaiton vector (0 -> 96 = 96 bits) length (96 ->128 = 32 bits) and encrypted data
    const ivBinary = binaryString.slice(0, 96);
    const lengthBinary = binaryString.slice(96, 128);
    const encryptedBinary = binaryString.slice(128);

    //convert back into bytes
    const iv = new Uint8Array(ivBinary.match(/.{8}/g).map(byte => parseInt(byte, 2)));
    const lengthBytes = new Uint8Array(lengthBinary.match(/.{8}/g).map(byte => parseInt(byte, 2)));
    const encryptedLength = new DataView(lengthBytes.buffer).getUint32(0, true);

    // validate and extract encrypted data from binaries
    if (encryptedBinary.length < encryptedLength * 8) {
        alert('Invalid or corrupted encoded data.');
        return;
    }

    const encryptedDataBinary = encryptedBinary.slice(0, encryptedLength * 8);
    const encryptedBuffer = new Uint8Array(encryptedDataBinary.match(/.{8}/g).map(byte => parseInt(byte, 2)));

    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedBuffer
        );

        const decryptedPassword = new TextDecoder().decode(decryptedBuffer);
        document.getElementById('decodedPassword').textContent = decryptedPassword;
    } catch (error) { //??enoguh
        console.error('Error during decryption:', error);
        alert('Failed to decrypt. Check encryption key and image.');
    }
});