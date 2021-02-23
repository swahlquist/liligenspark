## CoughDrop - Translations

Thanks for your interest in helping us share CoughDrop with as many people as possible!
CoughDrop is an open source AAC system that is used by AAC communicators around the
world. We are grateful for any help you can provide in increasing its access to others,
and will happily give you credit for your translation work!

As you translate, please try to keep the same tone of voice we use in the existing
CoughDrop app. We try to remain positive and friendly, but not too informal. Please
try to keep labels and buttons as clear and concise as possible. Paragraphs of text
can adjust freely, but buttons and labels often have limited space in which to be
shown. Also please try to match capitalization where posssible.

### Translation Files

CoughDrop supports displaying the app interface in multiple languages. Each language must
be manually enabled once an acceptable preliminary translation file has been generated.
Translation files are contained in this repository under the `public/locales` directory.

Each locale is stored as a `json` file, which can be opened using any text-based editor
or in the GitHub interface itself. Each line will look like one of the following:

```
  "string_key1": "Fully-Approved Translation String",
  "string_key2": "Automatically Translated String [[ English Version for Reference and Confirmation",
  "string_key3": "*** English Text (no Automatic Translation was found or added)",

```

#### Numbers

One exception is strings related to numbers. These will look as folloows:

```
  "n_apples": "0 Apples || 1 Apple || %{n} Apples"
```

We include all three number formattings for labels in a single string, as you can see,
separated by `||`. The program will automatically extract just the correct string given
where and how it is being used, as long as you provide all three options in
this order.

### How to Edit Translation Files

Strings are loosely sorted into levels, with the highest levels being more important
for the user interface. 

Any strings that start with `*** ` should be translated first
because there is no translation string available, so English text will be shown in
the interface instead. When you enter a replacement, simple remove the  "*** " at the beginning of the string or the program will not know it has been translated.

Strings that have been auto-translated will end with
`[[` followed by the English text. This is so you can compare them to the original
text for consistency (auto-translation is okay but not great). Rather than removing all 
of these by hand as you work through the translation file, it will probably be easier
to keep track of which string key you have gotten to and continue from there.
We have automated scripts that can remove all the English text at once or in a batch
that prevent you from having to do it all by hand.

Once you have a partial or a completed translation file, please share it back to our
team and we will merge your translations into the existing file.

### New Translations

If you are interested in adding a new translation file, please contact our team
and we can create a preliminary file with auto-translations added to save you time.

### Approval Process

Please keep in mind, depending on our prior relationship with you, we may need to vet
your translation file with other translators or experts to ensure it is up to our
professional standards. Please be patient as we do this.