files = []
dirs = Dir.glob('*')
incr = 0
while dirs.length > 0
  incr += 1
  dir = dirs.pop
  if dir.match(/^app/) && dir.match(/\.js$/) && dir != 'vendor.js' && dir != 'frontend.js'
    files << dir
  elsif !dir.match(/\./)
    dirs += Dir.glob("#{dir}/*") unless dir.match(/node_modules|bower_components|test|dist|vendor/)
  end
end
re = /: function\(\) \{/
puts files.join("\n\t\t")
files.each do |file|
  puts file
  str = File.read(file) rescue ""
  orig_str = str.dup
  changed = true
  while changed
    changed = false
    last_idx = 0
    idx = str.index(re, last_idx + 1)
    last_idx = idx
    if idx
      start = idx
      func_idx = str.index(re, start + 1) || (str.length + 9999)
      prop_idx = str.index(/\}\.property\(/, start + 1)
      if prop_idx && prop_idx < func_idx
        str[prop_idx, 1] = "})"
        str[start, 2] = ": computed("
        changed = true
      end
    end
  end
  if orig_str != str
    puts "  **#{file}" 
    File.write(file, str)
  end
end
