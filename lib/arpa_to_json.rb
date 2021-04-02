module ArpaToJson
  # https://sourceforge.net/projects/cmusphinx/files/Acoustic%20and%20Language%20Models/
  # https://goofy.zamia.org/zamia-speech/lm/
  def self.convert(fn=nil)
    fn ||= "../ngrams.arpa"
    content = File.read(fn)
    lines = content.split(/\n/)
    res = {}
    context = nil
    scores = {}
    lines.each do |line|
      next if line.match(/\</) || line.match(/\\u/)
      match = line.match(/^\\(\d+)-grams:/)
      if match
        context = match[1].to_i
      elsif context
        units = line.split(/\s+/)
        if units.length == (context + 1) || units.length == (context + 2)
          units = units[0, context + 1]
          prob = units.shift.to_f
          final = units.pop
          pre = units.join(" ")
          if pre == ""
            next if prob < -5.5
          else
            next if prob < -4.5
          end
          if !res[pre]
            if pre != ""
              goody = scores[pre]
              next unless goody
            end
            puts "new pre: " + pre.to_json
            res[pre] = []
          end
          scores[final] = true if pre == "" && prob > -3.5
          res[pre] << [final, prob]
        end
      end
    end
    puts "PARSED!"
    res.keys.each do |key|
      res[key] = res[key].sort_by{|u| u[1] }.reverse
    end
    puts "SORTED!"
    all_keys = res.keys - [""]
    
    File.open(fn + ".11.json", 'w') do |f|
      f.puts res.to_json
    end
    
    idx = 0
    res[""].each_slice((res[""].length / 3.0).ceil) do |slice|
      File.open(fn + ".#{idx}.11.json", 'w') do |f|
        h = {}
        h[""] = slice
        f.puts h.to_json
      end
      idx += 1
    end
    all_keys.each_slice((all_keys.length / 7.0).ceil) do |slice|
      hash = {}
      slice.each do |key|
        hash[key] = res[key]
      end
      File.open(fn + ".#{idx}.11.json", 'w') do |f|
        f.puts hash.to_json
      end
      idx += 1
    end
  end
end